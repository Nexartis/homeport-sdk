/**
 * NNN SDK — NnnClient
 *
 * Typed HTTP client for the Nexartis NANDA Node.
 * Wraps registry, orchestration, health, stats, agent facts,
 * and NANDA index endpoints with retry logic.
 *
 * Config injection: all credentials and URLs via constructor — no env reads.
 *
 * @module core/client
 */

import type {
	NnnConfig,
	NnnHealthStatus,
	NnnAgent,
	RegisterAgentRequest,
	RegisterAgentResponse,
	SearchAgentsParams,
	AgentCard,
	AgentFacts,
	NandaIndex,
	NnnStats,
	WorkflowRecord,
	WorkflowRunResult,
	CreateWorkflowRequest,
	SendA2ARequestParams,
	A2ARequest,
	A2AResponse,
	UpdateAgentRequest,
	AgentRefreshResult,
	RouteRequestParams,
	RoutingResult,
	WorkflowRunStatus,
	WorkflowRun,
	IndexDiffResult,
	IndexChangeCallback,
	IndexChangeEvent,
	NnnHooks,
	NnnCircuitBreakerConfig,
	PaginatedResponse,
	WorkflowDetail,
	UpdateWorkflowRequest,
	DelegateTaskRequest,
	DelegationResult,
	ListPatternsOptions,
	OrchestratorPattern,
	CreatePatternRequest,
	ListConflictsParams,
	OrchestrationConflict,
	RaiseConflictRequest,
	ConflictOutcome,
	AgentAddr,
	ResolutionContext,
	ResolutionResult,
	ReputationEntry,
	TrustScoresOptions,
	TrustFrameworksOptions,
	CreateSubscriptionRequest,
	CreateInvoiceRequest,
	CreateCheckoutRequest,
	CheckoutSession,
	CreateWebhookRequest,
	CreateWebhookResponse,
	WebhookSubscription,
	EarningsActionRequest,
	// Sprint C types
	DeveloperApiKey,
	CreateDeveloperKeyRequest,
	CreateDeveloperKeyResponse,
	RevokeDeveloperKeyResponse,
	DeprecateAgentRequest,
	DeprecateAgentResponse,
	TombstoneAgentResponse,
	CreateAgentVersionRequest,
	AgentVersion,
	ComplianceScanResult,
	TrustGraphResponse,
	TrustPathResponse,
	BehaviorAnalyticsResponse,
	VerifyNpPaymentRequest,
	VerifyNpPaymentResponse
} from './types';

import { fetchWithRetry } from './retry';
import { createNnnLogger, type NnnLogger } from './logger';
import { NnnError, NnnErrorCode } from './errors';
import { SDK_VERSION } from './version';
import { CircuitBreaker } from './circuit-breaker';
import type { NnnClientInternals } from './namespace-helpers';
import {
	AgentsNamespace,
	OrchestrationNamespace,
	TrustNamespace,
	FederationNamespace,
	WebhooksNamespace,
	DevelopersNamespace,
	BillingNamespace
} from './namespaces';

export { SDK_VERSION } from './version';

/** Generate a unique request ID, safe across all JS runtimes. */
function generateRequestId(): string {
	try {
		if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
			return globalThis.crypto.randomUUID();
		}
	} catch { /* crypto.randomUUID unavailable — fall back to timestamp+random */ }
	return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Safely invoke a callback that may be sync or async, swallowing errors. */
async function safeCallback(
	logger: NnnLogger,
	cb: IndexChangeCallback,
	event: IndexChangeEvent
): Promise<void> {
	try {
		await cb(event);
	} catch (err) {
		logger.warn('Index callback error', { error: err instanceof Error ? err.message : String(err) });
	}
}

/**
 * Detect whether a request targets an SSE (text/event-stream) endpoint.
 * Handles plain-object headers, `Headers` instances, and case-insensitive
 * Accept values so detection remains reliable even if a `beforeRequest` hook
 * mutates the headers.
 */
function isStreamingRequest(init: RequestInit): boolean {
	if (!init.headers) return false;

	let accept: string | null | undefined;
	if (init.headers instanceof Headers) {
		accept = init.headers.get('Accept');
	} else if (typeof init.headers === 'object') {
		// Plain object — try common casings
		const h = init.headers as Record<string, string>;
		accept = h['Accept'] ?? h['accept'] ?? h['ACCEPT'];
	}

	if (!accept) return false;
	// Handle combined values like "text/event-stream, application/json"
	return accept.toLowerCase().includes('text/event-stream');
}

// ── Response Cache (B-4) ─────────────────────────────────────────────

/** Simple TTL-based response cache with pattern invalidation. */
class ResponseCache {
	private cache = new Map<string, { data: unknown; expiresAt: number }>();
	private defaultTtlMs: number;

	constructor(defaultTtlMs: number) {
		this.defaultTtlMs = defaultTtlMs;
	}

	get<T>(key: string): T | undefined {
		const entry = this.cache.get(key);
		if (!entry) return undefined;
		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			return undefined;
		}
		return entry.data as T;
	}

	set(key: string, data: unknown, ttlMs?: number): void {
		this.cache.set(key, {
			data,
			expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs)
		});
	}

	/** Invalidate entries matching a pattern, or clear all if no pattern given. */
	invalidate(pattern?: string | RegExp): void {
		if (!pattern) {
			this.cache.clear();
			return;
		}
		const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
		for (const key of this.cache.keys()) {
			if (regex.test(key)) this.cache.delete(key);
		}
	}
}

export class NnnClient {
	readonly baseUrl: string;
	private apiKey: string | null;
	private logger: NnnLogger;
	private retryConfig: NnnConfig['retryConfig'];
	private hooks: NnnHooks;
	private traceContext: { traceparent?: string; tracestate?: string };
	private circuitBreaker: CircuitBreaker;

	/** In-flight GET request deduplication map (B-3). */
	private inflightGets = new Map<string, Promise<Response>>();

	/** Opt-in response cache (B-4). */
	private responseCache: ResponseCache | null;

	// ── Namespace instances (D-1) ────────────────────────────────────
	private _agents: AgentsNamespace | null = null;
	private _orchestration: OrchestrationNamespace | null = null;
	private _trust: TrustNamespace | null = null;
	private _federation: FederationNamespace | null = null;
	private _webhooksNs: WebhooksNamespace | null = null;
	private _developers: DevelopersNamespace | null = null;
	private _billing: BillingNamespace | null = null;

	/** Internal bridge object shared with namespace classes. */
	private _internals: NnnClientInternals | null = null;

	constructor(config: NnnConfig) {
		if (!config.baseUrl) {
			throw new NnnError(NnnErrorCode.CONFIGURATION_ERROR, 'NnnClient requires config.baseUrl');
		}
		this.baseUrl = config.baseUrl.replace(/\/+$/, '');
		this.apiKey = config.apiKey ?? null;
		this.logger = createNnnLogger(config.verbose ?? false);
		this.retryConfig = config.retryConfig;
		this.hooks = config.hooks ?? {};
		this.traceContext = config.traceContext ?? {};
		this.circuitBreaker = new CircuitBreaker(config.circuitBreaker, this.logger);

		// Response cache — disabled by default
		if (config.cache) {
			this.responseCache = new ResponseCache(config.cache.defaultTtlMs ?? 60_000);
		} else {
			this.responseCache = null;
		}
	}

	// ── Namespace accessors (Sprint D) ────────────────────────────────

	/** @internal — Lazily build the internals bridge. */
	private internals(): NnnClientInternals {
		if (!this._internals) {
			this._internals = {
				getJson: this.getJson.bind(this),
				postJson: this.postJson.bind(this),
				putJson: this.putJson.bind(this),
				deleteJson: this.deleteJson.bind(this),
				patchJson: this.patchJson.bind(this),
				fetch: this.fetch.bind(this),
				get baseUrl() { return ''; }, // replaced below
				logger: this.logger,
				headers: this.headers.bind(this),
				externalHeaders: this.externalHeaders.bind(this),
				safeParseJson: this.safeParseJson.bind(this)
			};
			// Use Object.defineProperty so baseUrl reflects the actual value
			Object.defineProperty(this._internals, 'baseUrl', { get: () => this.baseUrl });
		}
		return this._internals;
	}

	/** Agent registration, lookup, search, lifecycle, facts, and versioning. */
	get agents(): AgentsNamespace {
		return (this._agents ??= new AgentsNamespace(this.internals()));
	}

	/** Workflows, runs, delegation, patterns, conflicts, routing, and index sync. */
	get orchestration(): OrchestrationNamespace {
		return (this._orchestration ??= new OrchestrationNamespace(this.internals()));
	}

	/** Resolution, reputation, trust scores/frameworks/graph, compliance, and analytics. */
	get trust(): TrustNamespace {
		return (this._trust ??= new TrustNamespace(this.internals()));
	}

	/** Federation peers, status, agents, and A2A communication. */
	get federation(): FederationNamespace {
		return (this._federation ??= new FederationNamespace(this.internals()));
	}

	/** Webhook subscription management. */
	get webhooksNs(): WebhooksNamespace {
		return (this._webhooksNs ??= new WebhooksNamespace(this.internals()));
	}

	/** Developer key management and earnings. */
	get developers(): DevelopersNamespace {
		return (this._developers ??= new DevelopersNamespace(this.internals()));
	}

	/** Subscriptions, invoices, checkout sessions, and NP payment verification. */
	get billing(): BillingNamespace {
		return (this._billing ??= new BillingNamespace(this.internals()));
	}

	// ── HTTP helpers ──────────────────────────────────────────────────

	private headers(): Record<string, string> {
		const h: Record<string, string> = {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'User-Agent': `@nexartis/nexartis-nanda-node-sdk/${SDK_VERSION}`
		};
		if (this.apiKey) h['Authorization'] = `Bearer ${this.apiKey}`;
		// OpenTelemetry trace context propagation (2.2)
		if (this.traceContext.traceparent) h['traceparent'] = this.traceContext.traceparent;
		if (this.traceContext.tracestate) h['tracestate'] = this.traceContext.tracestate;
		return h;
	}

	/**
	 * Return headers safe for third-party (off-domain) requests.
	 * Strips the registry Authorization token to prevent credential leakage.
	 */
	private externalHeaders(): Record<string, string> {
		const h = this.headers();
		delete h['Authorization'];
		return h;
	}

	/** Update trace context for subsequent requests. */
	setTraceContext(ctx: { traceparent?: string; tracestate?: string }): void {
		this.traceContext = ctx;
	}

	/** Invalidate cache entries matching the given pattern. */
	invalidateCache(pattern?: string | RegExp): void {
		this.responseCache?.invalidate(pattern);
	}

	/**
	 * Internal fetch with circuit breaker, hooks, idempotency, and retry logic.
	 * Set `skipBreaker` to true for external (A2A) calls that should not
	 * affect the registry circuit breaker state.
	 */
	private async fetch(url: string, init: RequestInit, context: string, skipBreaker = false): Promise<Response> {
		if (!skipBreaker) this.circuitBreaker.check();

		const startTime = Date.now();

		try {
			// Run beforeRequest inside try so hook failures are handled
			// consistently with request failures (onError, circuit breaker).
			await this.hooks.beforeRequest?.(url, init);

			const response = await fetchWithRetry(url, init, context, this.retryConfig);
			const durationMs = Date.now() - startTime;

			const isSSE = isStreamingRequest(init);

			// Fire afterResponse for non-streaming responses.
			// For SSE (text/event-stream) responses, skip cloning — clone() tees
			// the ReadableStream, and if the hook doesn't fully consume the
			// cloned branch it will buffer indefinitely for long-lived streams.
			if (!isSSE) {
				await this.hooks.afterResponse?.(url, response.clone(), durationMs);
			}

			if (!response.ok) {
				// HTTP error — record failure only for server errors (5xx),
				// not client errors (4xx) which indicate caller issues, not
				// service degradation.
				const bodyText = await response.text();
				const error = NnnError.fromStatus(
					response.status,
					`${context} failed (${response.status}): ${bodyText}`
				);
				error.context.durationMs = durationMs;
				if (!skipBreaker && response.status >= 500) this.circuitBreaker.recordFailure();
				await this.hooks.onError?.(url, error);
				throw error;
			}

			// Note: recordSuccess is deferred to safeParseJson() for JSON callers
			// so that a JSON parse failure doesn't prematurely reset the streak.
			// Streaming callers bypass safeParseJson, so record success here.
			if (!skipBreaker && isSSE) {
				this.circuitBreaker.recordSuccess();
			}
			return response;
		} catch (err) {
			// Re-throw errors already handled above (HTTP errors)
			if (err instanceof NnnError && err.context.durationMs !== undefined) {
				throw err;
			}
			const durationMs = Date.now() - startTime;

			// 429 (rate-limit) is a client-side throttle, not a server failure —
			// don't let it trip the circuit breaker.
			const is429 = err instanceof NnnError && err.statusCode === 429;
			if (!skipBreaker && !is429) this.circuitBreaker.recordFailure();

			// Enrich NnnError with duration context before firing onError
			// so hook consumers can access timing information
			if (err instanceof NnnError) {
				err.context.durationMs = durationMs;

				// Fire afterResponse for retried-out 5xx/429 errors that carry
				// the last HTTP response, honouring the "fires for every response"
				// contract documented on NnnHooks.afterResponse.
				// Clone the response so afterResponse body consumption doesn't
				// prevent onError from inspecting the same response.
				if (err.lastResponse) {
					await this.hooks.afterResponse?.(url, err.lastResponse.clone(), durationMs);
				}
			}
			await this.hooks.onError?.(url, err);
			throw err;
		}
	}

	/** Attach Idempotency-Key header for mutating requests (B-2). */
	private mutatingHeaders(): Record<string, string> {
		const h = this.headers();
		h['Idempotency-Key'] = generateRequestId();
		return h;
	}

	/**
	 * GET JSON helper with deduplication and optional caching.
	 * Concurrent identical GETs share a single in-flight request (B-3).
	 * Results are optionally cached (B-4).
	 */
	private async getJson<T>(path: string, ctx: string, skipCache = false): Promise<T> {
		const url = `${this.baseUrl}${path}`;

		// Check cache first (B-4)
		if (!skipCache && this.responseCache) {
			const cached = this.responseCache.get<T>(url);
			if (cached !== undefined) return cached;
		}

		// Dedup concurrent GETs (B-3)
		let inflight = this.inflightGets.get(url);
		if (!inflight) {
			inflight = this.fetch(url, { headers: this.headers() }, ctx);
			this.inflightGets.set(url, inflight);
		}

		try {
			const res = await inflight;
			const data = await this.safeParseJson<T>(res, ctx);

			// Store in cache (B-4)
			if (!skipCache && this.responseCache) {
				this.responseCache.set(url, data);
			}

			return data;
		} finally {
			this.inflightGets.delete(url);
		}
	}

	/**
	 * POST JSON helper with idempotency key.
	 */
	private async postJson<T>(path: string, body: unknown, ctx: string): Promise<T> {
		const res = await this.fetch(
			`${this.baseUrl}${path}`,
			{ method: 'POST', headers: this.mutatingHeaders(), body: JSON.stringify(body) },
			ctx
		);
		return this.safeParseJson<T>(res, ctx);
	}

	/**
	 * PUT JSON helper with idempotency key.
	 */
	private async putJson<T>(path: string, body: unknown, ctx: string): Promise<T> {
		const res = await this.fetch(
			`${this.baseUrl}${path}`,
			{ method: 'PUT', headers: this.mutatingHeaders(), body: JSON.stringify(body) },
			ctx
		);
		return this.safeParseJson<T>(res, ctx);
	}

	/**
	 * DELETE JSON helper with idempotency key.
	 */
	private async deleteJson<T>(path: string, ctx: string): Promise<T> {
		const res = await this.fetch(
			`${this.baseUrl}${path}`,
			{ method: 'DELETE', headers: this.mutatingHeaders() },
			ctx
		);
		return this.safeParseJson<T>(res, ctx);
	}

	/**
	 * PATCH JSON helper with idempotency key.
	 */
	private async patchJson<T>(path: string, body: unknown, ctx: string): Promise<T> {
		const res = await this.fetch(
			`${this.baseUrl}${path}`,
			{ method: 'PATCH', headers: this.mutatingHeaders(), body: JSON.stringify(body) },
			ctx
		);
		return this.safeParseJson<T>(res, ctx);
	}

	/**
	 * Parse JSON from a response, recording failure and firing onError if parsing throws.
	 * Records success only after the body is successfully parsed, so that a JSON parse
	 * failure doesn't prematurely reset a circuit breaker failure streak.
	 * Pass `skipBreaker` to avoid recording state for external (A2A) calls.
	 */
	private async safeParseJson<T>(res: Response, ctx: string, skipBreaker = false): Promise<T> {
		try {
			const data = await res.json() as T;
			if (!skipBreaker) this.circuitBreaker.recordSuccess();
			return data;
		} catch (err) {
			if (!skipBreaker) this.circuitBreaker.recordFailure();
			const parseError = new NnnError(
				NnnErrorCode.SERVER_ERROR,
				`${ctx}: failed to parse response body as JSON`
			);
			await this.hooks.onError?.(res.url, parseError);
			throw parseError;
		}
	}

	// ── Health ────────────────────────────────────────────────────────

	/** GET /health */
	async health(): Promise<NnnHealthStatus> {
		return this.getJson('/health', 'health');
	}

	/** Convenience: is NNN healthy? Never throws. */
	async isHealthy(): Promise<boolean> {
		try {
			const h = await this.health();
			return h.status === 'ok';
		} catch {
			return false;
		}
	}

	/**
	 * Deep health check — returns full health status including individual subsystem checks.
	 * Unlike health(), this provides a summary `healthy` boolean and per-check details.
	 */
	async deepHealth(): Promise<NnnHealthStatus & { healthy: boolean; degradedChecks: string[] }> {
		const h = await this.health();
		const degradedChecks = Object.entries(h.checks)
			.filter(([, v]) => v !== 'ok')
			.map(([k]) => k);
		return {
			...h,
			healthy: h.status === 'ok' && degradedChecks.length === 0,
			degradedChecks
		};
	}

	// ── Registry ─────────────────────────────────────────────────────

	/** @deprecated Use `client.agents.register()` instead. */
	async registerAgent(req: RegisterAgentRequest): Promise<RegisterAgentResponse> {
		return this.agents.register(req);
	}

	/** @deprecated Use `client.agents.lookup()` instead. */
	async lookupAgent(agentId: string): Promise<NnnAgent> {
		return this.agents.lookup(agentId);
	}

	/** @deprecated Use `client.agents.search()` instead. */
	async searchAgents(params: SearchAgentsParams = {}): Promise<NnnAgent[]> {
		return this.agents.search(params);
	}

	/** @deprecated Use `client.agents.list()` instead. */
	async listAgents(): Promise<NnnAgent[]> {
		return this.agents.list();
	}

	// ── Pagination Iterators ─────────────────────────────────────────

	/** @internal — kept for backward compat; namespace classes have their own. */
	private normalizePage<T>(raw: T[] | PaginatedResponse<T>): PaginatedResponse<T> {
		if (Array.isArray(raw)) {
			return { data: raw, hasMore: false, cursor: undefined };
		}
		return raw;
	}

	/** @deprecated Use `client.agents.searchAll()` instead. */
	async *searchAgentsAll(params: SearchAgentsParams = {}): AsyncGenerator<NnnAgent> {
		yield* this.agents.searchAll(params);
	}

	/** @deprecated Use `client.agents.listAll()` instead. */
	async *listAgentsAll(params: { limit?: number; cursor?: string } = {}): AsyncGenerator<NnnAgent> {
		yield* this.agents.listAll(params);
	}

	// ── Agent Facts & Card ───────────────────────────────────────────

	/** @deprecated Use `client.agents.getFacts()` instead. */
	async getAgentFacts(agentId: string): Promise<AgentFacts> {
		return this.agents.getFacts(agentId);
	}

	/** @deprecated Use `client.agents.getCard()` instead. */
	async getAgentCard(): Promise<AgentCard> {
		return this.agents.getCard();
	}

	/** @deprecated Use `client.agents.getNandaIndex()` instead. */
	async getNandaIndex(): Promise<NandaIndex> {
		return this.agents.getNandaIndex();
	}

	// ── Stats ────────────────────────────────────────────────────────

	/** @deprecated Use `client.orchestration.stats()` instead. */
	async getStats(): Promise<NnnStats> {
		return this.orchestration.stats();
	}

	// ── Orchestration ────────────────────────────────────────────────

	/** @deprecated Use `client.orchestration.createWorkflow()` instead. */
	async createWorkflow(req: CreateWorkflowRequest): Promise<{ status: string; workflow: WorkflowRecord }> {
		return this.orchestration.createWorkflow(req);
	}

	/** @deprecated Use `client.orchestration.listWorkflows()` instead. */
	async listWorkflows(params: { ownerId?: string; status?: string } = {}): Promise<{ workflows: WorkflowRecord[] }> {
		return this.orchestration.listWorkflows(params);
	}

	/** @deprecated Use `client.orchestration.runWorkflow()` instead. */
	async runWorkflow(workflowId: string, input?: Record<string, unknown>): Promise<WorkflowRunResult> {
		return this.orchestration.runWorkflow(workflowId, input);
	}

	/** @deprecated Use `client.orchestration.getWorkflow()` instead. */
	async getWorkflow(workflowId: string): Promise<WorkflowDetail> {
		return this.orchestration.getWorkflow(workflowId);
	}

	/** @deprecated Use `client.orchestration.updateWorkflow()` instead. */
	async updateWorkflow(workflowId: string, updates: UpdateWorkflowRequest): Promise<{ ok: boolean; workflow: WorkflowRecord }> {
		return this.orchestration.updateWorkflow(workflowId, updates);
	}

	/** @deprecated Use `client.orchestration.deleteWorkflow()` instead. */
	async deleteWorkflow(workflowId: string): Promise<{ ok: boolean; deleted: string }> {
		return this.orchestration.deleteWorkflow(workflowId);
	}

	/** @deprecated Use `client.orchestration.delegateTask()` instead. */
	async delegateTask(params: DelegateTaskRequest): Promise<DelegationResult> {
		return this.orchestration.delegateTask(params);
	}

	/** @deprecated Use `client.orchestration.listDelegations()` instead. */
	async listDelegations(workflowId: string): Promise<{ delegations: DelegationResult[] }> {
		return this.orchestration.listDelegations(workflowId);
	}

	/** @deprecated Use `client.orchestration.listPatterns()` instead. */
	async listPatterns(options: ListPatternsOptions = {}): Promise<{ patterns: OrchestratorPattern[] }> {
		return this.orchestration.listPatterns(options);
	}

	/** @deprecated Use `client.orchestration.createPattern()` instead. */
	async createPattern(params: CreatePatternRequest): Promise<{ status: string; pattern: OrchestratorPattern }> {
		return this.orchestration.createPattern(params);
	}

	/** @deprecated Use `client.orchestration.listConflicts()` instead. */
	async listConflicts(params: ListConflictsParams = {}): Promise<{ conflicts: OrchestrationConflict[]; total: number }> {
		return this.orchestration.listConflicts(params);
	}

	/** @deprecated Use `client.orchestration.raiseConflict()` instead. */
	async raiseConflict(params: RaiseConflictRequest): Promise<ConflictOutcome> {
		return this.orchestration.raiseConflict(params);
	}

	// ── Resolution & Trust ──────────────────────────────────────────

	/** @deprecated Use `client.trust.resolveAgent()` instead. */
	async resolveAgent(agentId: string): Promise<AgentAddr> {
		return this.trust.resolveAgent(agentId);
	}

	/** @deprecated Use `client.trust.adaptiveResolve()` instead. */
	async adaptiveResolve(agentId: string, context?: ResolutionContext): Promise<ResolutionResult> {
		return this.trust.adaptiveResolve(agentId, context);
	}

	/** @deprecated Use `client.trust.getReputation()` instead. */
	async getReputation(): Promise<{ agents: ReputationEntry[]; total: number; fetchedAt: string }> {
		return this.trust.getReputation();
	}

	/** @deprecated Use `client.trust.getScores()` instead. */
	async getTrustScores(options: TrustScoresOptions = {}): Promise<Record<string, unknown>> {
		return this.trust.getScores(options);
	}

	/** @deprecated Use `client.trust.getFrameworks()` instead. */
	async getTrustFrameworks(options: TrustFrameworksOptions = {}): Promise<Record<string, unknown>> {
		return this.trust.getFrameworks(options);
	}

	/** @deprecated Use `client.trust.syncCrossRegistry()` instead. */
	async syncCrossRegistryTrust(adminKey?: string): Promise<Record<string, unknown>> {
		return this.trust.syncCrossRegistry(adminKey);
	}

	// ── Billing & Subscriptions ─────────────────────────────────────

	/** @deprecated Use `client.billing.getSubscription()` instead. */
	async getSubscription(keyId: string): Promise<Record<string, unknown>> {
		return this.billing.getSubscription(keyId);
	}

	/** @deprecated Use `client.billing.createSubscription()` instead. */
	async createSubscription(params: CreateSubscriptionRequest): Promise<Record<string, unknown>> {
		return this.billing.createSubscription(params);
	}

	/** @deprecated Use `client.billing.listInvoices()` instead. */
	async listInvoices(keyId: string): Promise<Record<string, unknown>> {
		return this.billing.listInvoices(keyId);
	}

	/** @deprecated Use `client.billing.createInvoice()` instead. */
	async createInvoice(params: CreateInvoiceRequest): Promise<Record<string, unknown>> {
		return this.billing.createInvoice(params);
	}

	// ── Checkout Sessions ───────────────────────────────────────────

	/** @deprecated Use `client.billing.createCheckoutSession()` instead. */
	async createCheckoutSession(params: CreateCheckoutRequest): Promise<CheckoutSession> {
		return this.billing.createCheckoutSession(params);
	}

	/** @deprecated Use `client.billing.getCheckoutSession()` instead. */
	async getCheckoutSession(sessionId: string): Promise<CheckoutSession> {
		return this.billing.getCheckoutSession(sessionId);
	}

	/** @deprecated Use `client.billing.submitCheckoutPayment()` instead. */
	async submitCheckoutPayment(sessionId: string, payment: Record<string, unknown>): Promise<Record<string, unknown>> {
		return this.billing.submitCheckoutPayment(sessionId, payment);
	}

	/** @deprecated Use `client.billing.cancelCheckoutSession()` instead. */
	async cancelCheckoutSession(sessionId: string): Promise<{ id: string; status: string }> {
		return this.billing.cancelCheckoutSession(sessionId);
	}

	// ── Webhooks ────────────────────────────────────────────────────

	/** @deprecated Use `client.webhooksNs.list()` instead. */
	async listWebhooks(): Promise<{ subscriptions: WebhookSubscription[] }> {
		return this.webhooksNs.list();
	}

	/** @deprecated Use `client.webhooksNs.create()` instead. */
	async createWebhook(params: CreateWebhookRequest): Promise<CreateWebhookResponse> {
		return this.webhooksNs.create(params);
	}

	/** @deprecated Use `client.webhooksNs.get()` instead. */
	async getWebhook(webhookId: string): Promise<{ subscription: WebhookSubscription }> {
		return this.webhooksNs.get(webhookId);
	}

	/** @deprecated Use `client.webhooksNs.update()` instead. */
	async updateWebhook(webhookId: string, action: 'pause' | 'resume'): Promise<Record<string, unknown>> {
		return this.webhooksNs.update(webhookId, action);
	}

	/** @deprecated Use `client.webhooksNs.delete()` instead. */
	async deleteWebhook(webhookId: string): Promise<{ ok: boolean; deleted: string }> {
		return this.webhooksNs.delete(webhookId);
	}

	// ── Earnings ────────────────────────────────────────────────────

	/** @deprecated Use `client.developers.getEarnings()` instead. */
	async getEarnings(developerId: string, view?: string): Promise<Record<string, unknown>> {
		return this.developers.getEarnings(developerId, view);
	}

	/** @deprecated Use `client.developers.earningsAction()` instead. */
	async earningsAction(params: EarningsActionRequest): Promise<Record<string, unknown>> {
		return this.developers.earningsAction(params);
	}

	// ── Federation ──────────────────────────────────────────────────

	/** @deprecated Use `client.federation.getPeers()` instead. */
	async getFederationPeers(): Promise<Record<string, unknown>> {
		return this.federation.getPeers();
	}

	/** @deprecated Use `client.federation.getStatus()` instead. */
	async getFederationStatus(): Promise<Record<string, unknown>> {
		return this.federation.getStatus();
	}

	/** @deprecated Use `client.federation.getAgents()` instead. */
	async getFederatedAgents(): Promise<Record<string, unknown>> {
		return this.federation.getAgents();
	}

	// ── 1.1 A2A JSON-RPC Client ─────────────────────────────────────

	/** @deprecated Use `client.federation.sendA2ARequest()` instead. */
	async sendA2ARequest(params: SendA2ARequestParams): Promise<A2AResponse> {
		return this.federation.sendA2ARequest(params);
	}

	/** @deprecated Use `client.federation.streamA2ARequest()` instead. */
	async *streamA2ARequest(params: SendA2ARequestParams): AsyncGenerator<A2AResponse, void, unknown> {
		yield* this.federation.streamA2ARequest(params);
	}

	// ── 1.2 Agent Lifecycle Management ──────────────────────────────

	/** @deprecated Use `client.agents.update()` instead. */
	async updateAgent(agentId: string, updates: UpdateAgentRequest): Promise<NnnAgent> {
		return this.agents.update(agentId, updates);
	}

	/** @deprecated Use `client.agents.updateStatus()` instead. */
	async updateAgentStatus(agentId: string, status: string, capabilities?: string[]): Promise<{ status: string }> {
		return this.agents.updateStatus(agentId, status, capabilities);
	}

	/** @deprecated Use `client.agents.delete()` instead. */
	async deleteAgent(agentId: string): Promise<{ status: string }> {
		return this.agents.delete(agentId);
	}

	/** @deprecated Use `client.agents.refresh()` instead. */
	async refreshAgent(agentId: string): Promise<AgentRefreshResult> {
		return this.agents.refresh(agentId);
	}

	// ── 1.3 Routing Engine ──────────────────────────────────────────

	/** @deprecated Use `client.orchestration.routeRequest()` instead. */
	async routeRequest(params: RouteRequestParams): Promise<RoutingResult> {
		return this.orchestration.routeRequest(params);
	}

	// ── 1.4 Workflow Execution & Monitoring ─────────────────────────

	/** @deprecated Use `client.orchestration.getWorkflowStatus()` instead. */
	async getWorkflowStatus(runId: string): Promise<WorkflowRunStatus> {
		return this.orchestration.getWorkflowStatus(runId);
	}

	/** @deprecated Use `client.orchestration.cancelWorkflowRun()` instead. */
	async cancelWorkflowRun(runId: string): Promise<{ status: string; run_id: string }> {
		return this.orchestration.cancelWorkflowRun(runId);
	}

	/** @deprecated Use `client.orchestration.streamWorkflowEvents()` instead. */
	async *streamWorkflowEvents(runId: string): AsyncGenerator<Record<string, unknown>, void, unknown> {
		yield* this.orchestration.streamWorkflowEvents(runId);
	}

	// ── 1.5 NANDA Index Sync ────────────────────────────────────────

	/** @deprecated Use `client.orchestration.diffIndex()` instead. */
	async diffIndex(since: Date): Promise<IndexDiffResult> {
		return this.orchestration.diffIndex(since);
	}

	/** @deprecated Use `client.orchestration.subscribeToIndex()` instead. */
	subscribeToIndex(callback: IndexChangeCallback, intervalMs = 30_000): () => void {
		return this.orchestration.subscribeToIndex(callback, intervalMs);
	}

	// ── Sprint C: Missing Endpoint Coverage ──────────────────────────

	/** @deprecated Use `client.orchestration.listWorkflowRuns()` instead. */
	async listWorkflowRuns(workflowId: string, limit = 20): Promise<{ runs: WorkflowRun[] }> {
		return this.orchestration.listWorkflowRuns(workflowId, limit);
	}

	/** @deprecated Use `client.developers.listKeys()` instead. */
	async listDeveloperKeys(): Promise<{ keys: DeveloperApiKey[] }> {
		return this.developers.listKeys();
	}

	/** @deprecated Use `client.developers.createKey()` instead. */
	async createDeveloperKey(req: CreateDeveloperKeyRequest): Promise<CreateDeveloperKeyResponse> {
		return this.developers.createKey(req);
	}

	/** @deprecated Use `client.developers.revokeKey()` instead. */
	async revokeDeveloperKey(keyId: string): Promise<RevokeDeveloperKeyResponse> {
		return this.developers.revokeKey(keyId);
	}

	/** @deprecated Use `client.agents.deprecate()` instead. */
	async deprecateAgent(agentId: string, req: DeprecateAgentRequest): Promise<DeprecateAgentResponse> {
		return this.agents.deprecate(agentId, req);
	}

	/** @deprecated Use `client.agents.tombstone()` instead. */
	async tombstoneAgent(agentId: string): Promise<TombstoneAgentResponse> {
		return this.agents.tombstone(agentId);
	}

	/** @deprecated Use `client.agents.listVersions()` instead. */
	async listAgentVersions(agentId: string): Promise<{ agent_id: string; count: number; versions: AgentVersion[] }> {
		return this.agents.listVersions(agentId);
	}

	/** @deprecated Use `client.agents.createVersion()` instead. */
	async createAgentVersion(agentId: string, req: CreateAgentVersionRequest): Promise<{ status: string; version: AgentVersion }> {
		return this.agents.createVersion(agentId, req);
	}

	/** @deprecated Use `client.trust.scanCompliance()` instead. */
	async scanCompliance(): Promise<ComplianceScanResult> {
		return this.trust.scanCompliance();
	}

	/** @deprecated Use `client.trust.getGraph()` instead. */
	async getTrustGraph(did: string): Promise<TrustGraphResponse> {
		return this.trust.getGraph(did);
	}

	/** @deprecated Use `client.trust.getPath()` instead. */
	async getTrustPath(fromDid: string, toDid: string): Promise<TrustPathResponse> {
		return this.trust.getPath(fromDid, toDid);
	}

	/** @deprecated Use `client.trust.getBehaviorAnalytics()` instead. */
	async getBehaviorAnalytics(
		agentId: string,
		options: { period?: 'daily' | 'weekly'; limit?: number } = {}
	): Promise<BehaviorAnalyticsResponse> {
		return this.trust.getBehaviorAnalytics(agentId, options);
	}

	/** @deprecated Use `client.billing.verifyNpPayment()` instead. */
	async verifyNpPayment(req: VerifyNpPaymentRequest): Promise<VerifyNpPaymentResponse> {
		return this.billing.verifyNpPayment(req);
	}
}



