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

	/** POST /register — Register an agent on the NANDA network. */
	async registerAgent(req: RegisterAgentRequest): Promise<RegisterAgentResponse> {
		this.logger.debug('Registering agent', { agentId: req.agent_id });
		return this.postJson('/register', req, 'registerAgent');
	}

	/** GET /lookup/:id — Lookup a single agent by ID. */
	async lookupAgent(agentId: string): Promise<NnnAgent> {
		return this.getJson(`/lookup/${encodeURIComponent(agentId)}`, 'lookupAgent');
	}

	/** GET /search?q=&capabilities=&tags= — Search agents. */
	async searchAgents(params: SearchAgentsParams = {}): Promise<NnnAgent[]> {
		const sp = new URLSearchParams();
		if (params.q) sp.set('q', params.q);
		if (params.capabilities?.length) sp.set('capabilities', params.capabilities.join(','));
		if (params.tags?.length) sp.set('tags', params.tags.join(','));
		if (params.min_trust !== undefined) sp.set('min_trust', String(params.min_trust));
		if (params.jurisdiction) sp.set('jurisdiction', params.jurisdiction);
		if (params.protocol) sp.set('protocol', params.protocol);
		if (params.limit !== undefined) sp.set('limit', String(params.limit));
		if (params.cursor) sp.set('cursor', params.cursor);
		const qs = sp.toString();
		return this.getJson(`/search${qs ? `?${qs}` : ''}`, 'searchAgents');
	}

	/** GET /list — List all registered agents. */
	async listAgents(): Promise<NnnAgent[]> {
		return this.getJson('/list', 'listAgents');
	}

	// ── Pagination Iterators ─────────────────────────────────────────

	/**
	 * Normalize a response that may be a bare array or a PaginatedResponse wrapper.
	 * Handles both shapes so generators work regardless of backend response format.
	 */
	private normalizePage<T>(raw: T[] | PaginatedResponse<T>): PaginatedResponse<T> {
		if (Array.isArray(raw)) {
			return { data: raw, hasMore: false, cursor: undefined };
		}
		return raw;
	}

	/**
	 * Auto-paginating search — yields agents one at a time across all pages.
	 * Uses cursor-based pagination under the hood.
	 */
	async *searchAgentsAll(params: SearchAgentsParams = {}): AsyncGenerator<NnnAgent> {
		let cursor: string | undefined = params.cursor;
		let hasMore = true;

		while (hasMore) {
			const sp = new URLSearchParams();
			if (params.q) sp.set('q', params.q);
			if (params.capabilities?.length) sp.set('capabilities', params.capabilities.join(','));
			if (params.tags?.length) sp.set('tags', params.tags.join(','));
			if (params.min_trust !== undefined) sp.set('min_trust', String(params.min_trust));
			if (params.jurisdiction) sp.set('jurisdiction', params.jurisdiction);
			if (params.protocol) sp.set('protocol', params.protocol);
			if (params.limit !== undefined) sp.set('limit', String(params.limit));
			if (cursor) sp.set('cursor', cursor);

			const qs = sp.toString();
			const raw = await this.getJson<NnnAgent[] | PaginatedResponse<NnnAgent>>(
				`/search${qs ? `?${qs}` : ''}`,
				'searchAgentsAll'
			);
			const page = this.normalizePage(raw);

			for (const agent of page.data) {
				yield agent;
			}

			// Guard: break if cursor didn't advance (prevents infinite loops)
			if (page.hasMore && page.cursor === cursor) break;
			cursor = page.cursor;
			hasMore = page.hasMore;
		}
	}

	/**
	 * Auto-paginating list — yields all registered agents across pages.
	 */
	async *listAgentsAll(params: { limit?: number; cursor?: string } = {}): AsyncGenerator<NnnAgent> {
		let cursor: string | undefined = params.cursor;
		let hasMore = true;

		while (hasMore) {
			const sp = new URLSearchParams();
			if (params.limit !== undefined) sp.set('limit', String(params.limit));
			if (cursor) sp.set('cursor', cursor);

			const qs = sp.toString();
			const raw = await this.getJson<NnnAgent[] | PaginatedResponse<NnnAgent>>(
				`/list${qs ? `?${qs}` : ''}`,
				'listAgentsAll'
			);
			const page = this.normalizePage(raw);

			for (const agent of page.data) {
				yield agent;
			}

			// Guard: break if cursor didn't advance (prevents infinite loops)
			if (page.hasMore && page.cursor === cursor) break;
			cursor = page.cursor;
			hasMore = page.hasMore;
		}
	}

	// ── Agent Facts & Card ───────────────────────────────────────────

	/** GET /agentfacts/:id — Get agent facts (AgentFacts v1/v2). */
	async getAgentFacts(agentId: string): Promise<AgentFacts> {
		return this.getJson(`/agentfacts/${encodeURIComponent(agentId)}`, 'getAgentFacts');
	}

	/** GET /.well-known/agent-card.json — Get the node's own A2A agent card. */
	async getAgentCard(): Promise<AgentCard> {
		return this.getJson('/.well-known/agent-card.json', 'getAgentCard');
	}

	/** GET /.well-known/nanda-index — Get the NANDA index descriptor. */
	async getNandaIndex(): Promise<NandaIndex> {
		return this.getJson('/.well-known/nanda-index', 'getNandaIndex');
	}

	// ── Stats ────────────────────────────────────────────────────────

	/** GET /stats — Get registry statistics. */
	async stats(): Promise<NnnStats> {
		return this.getJson('/stats', 'stats');
	}

	// ── Orchestration ────────────────────────────────────────────────

	/** POST /api/orchestration — Create a workflow with a DAG. */
	async createWorkflow(req: CreateWorkflowRequest): Promise<{ status: string; workflow: WorkflowRecord }> {
		this.logger.debug('Creating workflow', { name: req.name });
		return this.postJson('/api/orchestration', req, 'createWorkflow');
	}

	/** GET /api/orchestration?owner_id=&status= — List workflows. */
	async listWorkflows(params: { ownerId?: string; status?: string } = {}): Promise<{ workflows: WorkflowRecord[] }> {
		const sp = new URLSearchParams();
		if (params.ownerId) sp.set('owner_id', params.ownerId);
		if (params.status) sp.set('status', params.status);
		const qs = sp.toString();
		return this.getJson(`/api/orchestration${qs ? `?${qs}` : ''}`, 'listWorkflows');
	}

	/** POST /api/orchestration/:id/runs — Start a new workflow run. */
	async runWorkflow(workflowId: string, input?: Record<string, unknown>): Promise<WorkflowRunResult> {
		this.logger.debug('Running workflow', { workflowId });
		return this.postJson(
			`/api/orchestration/${encodeURIComponent(workflowId)}/runs`,
			input ?? {},
			'runWorkflow'
		);
	}

	/** GET /api/orchestration/:id — Get a single workflow by ID. */
	async getWorkflow(workflowId: string): Promise<WorkflowDetail> {
		return this.getJson(`/api/orchestration/${encodeURIComponent(workflowId)}`, 'getWorkflow');
	}

	/** PATCH /api/orchestration/:id — Update a workflow. */
	async updateWorkflow(
		workflowId: string,
		updates: UpdateWorkflowRequest
	): Promise<{ ok: boolean; workflow: WorkflowRecord }> {
		this.logger.debug('Updating workflow', { workflowId });
		return this.patchJson(`/api/orchestration/${encodeURIComponent(workflowId)}`, updates, 'updateWorkflow');
	}

	/** DELETE /api/orchestration/:id — Delete a workflow. */
	async deleteWorkflow(workflowId: string): Promise<{ ok: boolean; deleted: string }> {
		this.logger.debug('Deleting workflow', { workflowId });
		return this.deleteJson(`/api/orchestration/${encodeURIComponent(workflowId)}`, 'deleteWorkflow');
	}

	/** POST /api/orchestration/delegate — Delegate a task to an agent. */
	async delegateTask(params: DelegateTaskRequest): Promise<DelegationResult> {
		this.logger.debug('Delegating task', { action: params.action, delegator: params.delegator_id });
		return this.postJson('/api/orchestration/delegate', params, 'delegateTask');
	}

	/** GET /api/orchestration/delegate?workflow_id= — List delegations for a workflow. */
	async listDelegations(workflowId: string): Promise<{ delegations: DelegationResult[] }> {
		const sp = new URLSearchParams({ workflow_id: workflowId });
		return this.getJson(`/api/orchestration/delegate?${sp.toString()}`, 'listDelegations');
	}

	/** GET /api/orchestration/patterns — List orchestration patterns. */
	async listPatterns(options: ListPatternsOptions = {}): Promise<{ patterns: OrchestratorPattern[] }> {
		const sp = new URLSearchParams();
		if (options.category) sp.set('category', options.category);
		if (options.builtin !== undefined) sp.set('builtin', String(options.builtin));
		const qs = sp.toString();
		return this.getJson(`/api/orchestration/patterns${qs ? `?${qs}` : ''}`, 'listPatterns');
	}

	/** POST /api/orchestration/patterns — Create a new orchestration pattern. */
	async createPattern(params: CreatePatternRequest): Promise<{ status: string; pattern: OrchestratorPattern }> {
		this.logger.debug('Creating pattern', { name: params.name });
		return this.postJson('/api/orchestration/patterns', params, 'createPattern');
	}

	/** GET /api/orchestration/conflicts — List orchestration conflicts. */
	async listConflicts(params: ListConflictsParams = {}): Promise<{ conflicts: OrchestrationConflict[]; total: number }> {
		const sp = new URLSearchParams();
		if (params.workflow_id) sp.set('workflow_id', params.workflow_id);
		if (params.run_id) sp.set('run_id', params.run_id);
		if (params.pending_only !== undefined) sp.set('pending_only', String(params.pending_only));
		const qs = sp.toString();
		return this.getJson(`/api/orchestration/conflicts${qs ? `?${qs}` : ''}`, 'listConflicts');
	}

	/** POST /api/orchestration/conflicts — Raise and resolve a conflict. */
	async raiseConflict(params: RaiseConflictRequest): Promise<ConflictOutcome> {
		this.logger.debug('Raising conflict', { workflowId: params.workflow_id });
		return this.postJson('/api/orchestration/conflicts', params, 'raiseConflict');
	}

	// ── Resolution & Trust ──────────────────────────────────────────

	/** GET /resolve/:agent_id — Resolve an agent to its address record. */
	async resolveAgent(agentId: string): Promise<AgentAddr> {
		return this.getJson(`/resolve/${encodeURIComponent(agentId)}`, 'resolveAgent');
	}

	/** POST /resolve — Adaptive resolution with context-aware ranking. */
	async adaptiveResolve(agentId: string, context?: ResolutionContext): Promise<ResolutionResult> {
		this.logger.debug('Adaptive resolve', { agentId });
		return this.postJson('/resolve', { agent_id: agentId, context }, 'adaptiveResolve');
	}

	/** GET /reputation — Get reputation scores for all agents. */
	async getReputation(): Promise<{ agents: ReputationEntry[]; total: number; fetchedAt: string }> {
		return this.getJson('/reputation', 'getReputation');
	}

	/** GET /api/trust/scores — Get trust scores (optionally for a single agent). */
	async getTrustScores(options: TrustScoresOptions = {}): Promise<Record<string, unknown>> {
		const sp = new URLSearchParams();
		if (options.agent) sp.set('agent', options.agent);
		if (options.offset !== undefined) sp.set('offset', String(options.offset));
		if (options.limit !== undefined) sp.set('limit', String(options.limit));
		const qs = sp.toString();
		return this.getJson(`/api/trust/scores${qs ? `?${qs}` : ''}`, 'getTrustScores');
	}

	/** GET /api/trust/framework — Get trust frameworks (optionally a single one). */
	async getTrustFrameworks(options: TrustFrameworksOptions = {}): Promise<Record<string, unknown>> {
		const sp = new URLSearchParams();
		if (options.id) sp.set('id', options.id);
		const qs = sp.toString();
		return this.getJson(`/api/trust/framework${qs ? `?${qs}` : ''}`, 'getTrustFrameworks');
	}

	/** POST /api/trust/cross-registry — Sync trust scores across federated registries. */
	async syncCrossRegistryTrust(adminKey?: string): Promise<Record<string, unknown>> {
		this.logger.debug('Syncing cross-registry trust');
		const headers: Record<string, string> = { ...this.headers() };
		if (adminKey) headers['Authorization'] = `Bearer ${adminKey}`;
		const res = await this.fetch(
			`${this.baseUrl}/api/trust/cross-registry`,
			{ method: 'POST', headers, body: JSON.stringify({}) },
			'syncCrossRegistryTrust'
		);
		return this.safeParseJson<Record<string, unknown>>(res, 'syncCrossRegistryTrust');
	}

	// ── Billing & Subscriptions ─────────────────────────────────────

	/** GET /api/subscriptions?keyId= — Get subscription for a key. */
	async getSubscription(keyId: string): Promise<Record<string, unknown>> {
		return this.getJson(`/api/subscriptions?keyId=${encodeURIComponent(keyId)}`, 'getSubscription');
	}

	/** POST /api/subscriptions — Create a new subscription. */
	async createSubscription(params: CreateSubscriptionRequest): Promise<Record<string, unknown>> {
		this.logger.debug('Creating subscription', { keyId: params.key_id, plan: params.plan });
		return this.postJson('/api/subscriptions', params, 'createSubscription');
	}

	/** GET /api/invoices?keyId= — List invoices for a key. */
	async listInvoices(keyId: string): Promise<Record<string, unknown>> {
		return this.getJson(`/api/invoices?keyId=${encodeURIComponent(keyId)}`, 'listInvoices');
	}

	/** POST /api/invoices — Create a new invoice. */
	async createInvoice(params: CreateInvoiceRequest): Promise<Record<string, unknown>> {
		this.logger.debug('Creating invoice', { keyId: params.key_id });
		return this.postJson('/api/invoices', params, 'createInvoice');
	}

	// ── Checkout Sessions ───────────────────────────────────────────

	/** POST /api/ucp/checkout-sessions — Create a checkout session. */
	async createCheckoutSession(params: CreateCheckoutRequest): Promise<CheckoutSession> {
		this.logger.debug('Creating checkout session', { capabilities: params.capabilities.length });
		return this.postJson('/api/ucp/checkout-sessions', params, 'createCheckoutSession');
	}

	/** GET /api/ucp/checkout-sessions?id= — Get a checkout session. */
	async getCheckoutSession(sessionId: string): Promise<CheckoutSession> {
		return this.getJson(`/api/ucp/checkout-sessions?id=${encodeURIComponent(sessionId)}`, 'getCheckoutSession');
	}

	/** PATCH /api/ucp/checkout-sessions/:id — Submit payment for a checkout session. */
	async submitCheckoutPayment(sessionId: string, payment: Record<string, unknown>): Promise<Record<string, unknown>> {
		this.logger.debug('Submitting checkout payment', { sessionId });
		return this.patchJson(`/api/ucp/checkout-sessions/${encodeURIComponent(sessionId)}`, { payment }, 'submitCheckoutPayment');
	}

	/** DELETE /api/ucp/checkout-sessions/:id — Cancel a checkout session. */
	async cancelCheckoutSession(sessionId: string): Promise<{ id: string; status: string }> {
		this.logger.debug('Cancelling checkout session', { sessionId });
		return this.deleteJson(`/api/ucp/checkout-sessions/${encodeURIComponent(sessionId)}`, 'cancelCheckoutSession');
	}

	// ── Webhooks ────────────────────────────────────────────────────

	/** GET /api/webhooks — List webhook subscriptions. */
	async listWebhooks(): Promise<{ subscriptions: WebhookSubscription[] }> {
		return this.getJson('/api/webhooks', 'listWebhooks');
	}

	/** POST /api/webhooks — Create a webhook subscription. */
	async createWebhook(params: CreateWebhookRequest): Promise<CreateWebhookResponse> {
		this.logger.debug('Creating webhook', { callbackUrl: params.callback_url, events: params.events });
		return this.postJson('/api/webhooks', params, 'createWebhook');
	}

	/** GET /api/webhooks/:id — Get a single webhook subscription. */
	async getWebhook(webhookId: string): Promise<{ subscription: WebhookSubscription }> {
		return this.getJson(`/api/webhooks/${encodeURIComponent(webhookId)}`, 'getWebhook');
	}

	/** PATCH /api/webhooks/:id — Update a webhook (pause/resume). */
	async updateWebhook(webhookId: string, action: 'pause' | 'resume'): Promise<Record<string, unknown>> {
		this.logger.debug('Updating webhook', { webhookId, action });
		return this.patchJson(`/api/webhooks/${encodeURIComponent(webhookId)}`, { action }, 'updateWebhook');
	}

	/** DELETE /api/webhooks/:id — Delete a webhook subscription. */
	async deleteWebhook(webhookId: string): Promise<{ ok: boolean; deleted: string }> {
		this.logger.debug('Deleting webhook', { webhookId });
		return this.deleteJson(`/api/webhooks/${encodeURIComponent(webhookId)}`, 'deleteWebhook');
	}

	// ── Earnings ────────────────────────────────────────────────────

	/** GET /api/developer/earnings — Get developer earnings. */
	async getEarnings(developerId: string, view?: string): Promise<Record<string, unknown>> {
		const sp = new URLSearchParams({ developerId });
		if (view) sp.set('view', view);
		return this.getJson(`/api/developer/earnings?${sp.toString()}`, 'getEarnings');
	}

	/** POST /api/developer/earnings — Perform an earnings action. */
	async earningsAction(params: EarningsActionRequest): Promise<Record<string, unknown>> {
		this.logger.debug('Earnings action', { action: params.action });
		return this.postJson('/api/developer/earnings', params, 'earningsAction');
	}

	// ── Federation ──────────────────────────────────────────────────

	/** GET /federation/peers — Get federation peer list. */
	async getFederationPeers(): Promise<Record<string, unknown>> {
		return this.getJson('/federation/peers', 'getFederationPeers');
	}

	/** GET /federation/status — Get federation status. */
	async getFederationStatus(): Promise<Record<string, unknown>> {
		return this.getJson('/federation/status', 'getFederationStatus');
	}

	/** GET /federation/agents — Get federated agents. */
	async getFederatedAgents(): Promise<Record<string, unknown>> {
		return this.getJson('/federation/agents', 'getFederatedAgents');
	}

	// ── 1.1 A2A JSON-RPC Client ─────────────────────────────────────

	/**
	 * Send an A2A JSON-RPC request to a target agent.
	 * Auto-discovers the agent URL via lookupAgent() if target_url is not provided.
	 */
	async sendA2ARequest(params: SendA2ARequestParams): Promise<A2AResponse> {
		let targetUrl = params.target_url;
		if (!targetUrl) {
			const agent = await this.lookupAgent(params.target_agent_id);
			targetUrl = agent.api_url ?? agent.agent_url;
		}

		const rpcRequest: A2ARequest = {
			jsonrpc: '2.0',
			id: generateRequestId(),
			method: params.method,
			params: params.params
		};

		this.logger.debug('Sending A2A request', {
			targetAgentId: params.target_agent_id,
			method: params.method
		});

		const res = await this.fetch(
			targetUrl,
			{ method: 'POST', headers: this.externalHeaders(), body: JSON.stringify(rpcRequest) },
			'sendA2ARequest',
			true // skip circuit breaker — external A2A failures must not trip registry breaker
		);
		return this.safeParseJson<A2AResponse>(res, 'sendA2ARequest', true);
	}

	/**
	 * Send an A2A streaming request (tasks/sendSubscribe) and yield SSE events.
	 * Returns an AsyncGenerator that yields parsed JSON-RPC responses from the SSE stream.
	 */
	async *streamA2ARequest(params: SendA2ARequestParams): AsyncGenerator<A2AResponse, void, unknown> {
		let targetUrl = params.target_url;
		if (!targetUrl) {
			const agent = await this.lookupAgent(params.target_agent_id);
			targetUrl = agent.api_url ?? agent.agent_url;
		}

		const rpcRequest: A2ARequest = {
			jsonrpc: '2.0',
			id: generateRequestId(),
			method: params.method,
			params: params.params
		};

		this.logger.debug('Streaming A2A request', {
			targetAgentId: params.target_agent_id,
			method: params.method
		});

		const headers = { ...this.externalHeaders(), Accept: 'text/event-stream' };
		const res = await this.fetch(
			targetUrl,
			{ method: 'POST', headers, body: JSON.stringify(rpcRequest) },
			'streamA2ARequest',
			true // skip circuit breaker — external A2A failures must not trip registry breaker
		);

		if (!res.body) {
			throw new NnnError(NnnErrorCode.NETWORK_ERROR, 'streamA2ARequest: response body is null');
		}

		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		try {
			// SSE spec: multiple consecutive `data:` lines form a single event,
			// joined by '\n'. A blank line signals the end of an event.
			const dataLines: string[] = [];
			let streamDone = false;

			const flushEvent = function* (self: NnnClient) {
				if (dataLines.length === 0) return;
				const payload = dataLines.splice(0).join('\n');
				if (payload === '[DONE]') {
					streamDone = true;
					return;
				}
				try {
					yield JSON.parse(payload) as A2AResponse;
				} catch {
					self.logger.warn('Failed to parse SSE data', { data: payload });
				}
			};

			while (!streamDone) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';

				for (const line of lines) {
					const trimmed = line.trim();
					if (trimmed.startsWith(':')) continue; // SSE comment
					if (!trimmed) {
						// Blank line — flush accumulated event
						yield* flushEvent(this);
						if (streamDone) break;
						continue;
					}
					if (trimmed.startsWith('data:')) {
						const data = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed.slice(5);
						dataLines.push(data);
					}
				}
			}
			// Flush any remaining data when stream ends without a trailing blank line
			if (!streamDone) yield* flushEvent(this);
		} finally {
			reader.cancel().catch((e) => this.logger.warn('streamA2ARequest: reader cancel failed', { error: e instanceof Error ? e.message : String(e) }));
			reader.releaseLock();
		}
	}

	// ── 1.2 Agent Lifecycle Management ──────────────────────────────

	/** PUT /agents/:id — Update an existing agent's fields (url, api, facts, capabilities, tags). */
	async updateAgent(agentId: string, updates: UpdateAgentRequest): Promise<NnnAgent> {
		this.logger.debug('Updating agent', { agentId });
		return this.putJson(`/agents/${encodeURIComponent(agentId)}`, updates, 'updateAgent');
	}

	/** PUT /agents/:id/status — Update an agent's status and capabilities. */
	async updateAgentStatus(agentId: string, status: string, capabilities?: string[]): Promise<{ status: string }> {
		this.logger.debug('Updating agent status', { agentId, status });
		return this.putJson(`/agents/${encodeURIComponent(agentId)}/status`, { status, capabilities }, 'updateAgentStatus');
	}

	/** DELETE /agents/:id — Delete an agent from the registry. */
	async deleteAgent(agentId: string): Promise<{ status: string }> {
		this.logger.debug('Deleting agent', { agentId });
		return this.deleteJson(`/agents/${encodeURIComponent(agentId)}`, 'deleteAgent');
	}

	/** POST /agents/:id/refresh — Re-crawl an agent's card and update facts. */
	async refreshAgent(agentId: string): Promise<AgentRefreshResult> {
		this.logger.debug('Refreshing agent', { agentId });
		return this.postJson(`/agents/${encodeURIComponent(agentId)}/refresh`, {}, 'refreshAgent');
	}

	// ── 1.3 Routing Engine ──────────────────────────────────────────

	/** POST /api/orchestration/route — Route a request to the best-matching agent. */
	async routeRequest(params: RouteRequestParams): Promise<RoutingResult> {
		this.logger.debug('Routing request', { skill: params.skill, strategy: params.strategy });
		return this.postJson('/api/orchestration/route', params, 'routeRequest');
	}

	// ── 1.4 Workflow Execution & Monitoring ─────────────────────────

	/** GET /api/orchestration/runs/:runId — Get workflow run status. */
	async getWorkflowStatus(runId: string): Promise<WorkflowRunStatus> {
		return this.getJson(
			`/api/orchestration/runs/${encodeURIComponent(runId)}`,
			'getWorkflowStatus'
		);
	}

	/** POST /api/orchestration/runs/:runId/cancel — Cancel an in-progress run. */
	async cancelWorkflowRun(runId: string): Promise<{ status: string; run_id: string }> {
		this.logger.debug('Cancelling workflow run', { runId });
		return this.postJson(
			`/api/orchestration/runs/${encodeURIComponent(runId)}/cancel`,
			{},
			'cancelWorkflowRun'
		);
	}

	/**
	 * SSE stream for real-time workflow execution events.
	 * Yields parsed event objects as they arrive.
	 */
	async *streamWorkflowEvents(runId: string): AsyncGenerator<Record<string, unknown>, void, unknown> {
		const url = `${this.baseUrl}/api/orchestration/runs/${encodeURIComponent(runId)}/events`;
		const headers = { ...this.headers(), Accept: 'text/event-stream' };

		const res = await this.fetch(url, { headers }, 'streamWorkflowEvents');

		if (!res.body) {
			throw new NnnError(NnnErrorCode.NETWORK_ERROR, 'streamWorkflowEvents: response body is null');
		}

		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		try {
			const dataLines: string[] = [];
			let streamDone = false;

			const flushEvent = function* (self: NnnClient) {
				if (dataLines.length === 0) return;
				const payload = dataLines.splice(0).join('\n');
				if (payload === '[DONE]') {
					streamDone = true;
					return;
				}
				try {
					yield JSON.parse(payload) as Record<string, unknown>;
				} catch {
					self.logger.warn('Failed to parse SSE event', { data: payload });
				}
			};

			while (!streamDone) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';

				for (const line of lines) {
					const trimmed = line.trim();
					if (trimmed.startsWith(':')) continue;
					if (!trimmed) {
						yield* flushEvent(this);
						if (streamDone) break;
						continue;
					}
					if (trimmed.startsWith('data:')) {
						const data = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed.slice(5);
						dataLines.push(data);
					}
				}
			}
			if (!streamDone) yield* flushEvent(this);
		} finally {
			reader.cancel().catch((e) => this.logger.warn('streamWorkflowEvents: reader cancel failed', { error: e instanceof Error ? e.message : String(e) }));
			reader.releaseLock();
		}
	}

	// ── 1.5 NANDA Index Sync ────────────────────────────────────────

	/** GET /.well-known/nanda-index/diff?since= — Get agents added/removed/updated since a timestamp. */
	async diffIndex(since: Date): Promise<IndexDiffResult> {
		const sp = new URLSearchParams({ since: since.toISOString() });
		return this.getJson(`/.well-known/nanda-index/diff?${sp.toString()}`, 'diffIndex');
	}

	/**
	 * Poll-based index change subscription.
	 * Polls diffIndex at the given interval and invokes the callback for each change.
	 * Returns an abort function to stop polling.
	 */
	subscribeToIndex(callback: IndexChangeCallback, intervalMs = 30_000): () => void {
		let lastCheck = new Date();
		let stopped = false;

		const poll = async () => {
			while (!stopped) {
				try {
					const diff = await this.diffIndex(lastCheck);
					const now = new Date();

					for (const agent of diff.added) {
						await safeCallback(this.logger, callback, { type: 'added', agent, timestamp: now.toISOString() });
					}
					for (const agent of diff.updated) {
						await safeCallback(this.logger, callback, { type: 'updated', agent, timestamp: now.toISOString() });
					}
					for (const agentId of diff.removed) {
						await safeCallback(this.logger, callback, {
							type: 'removed',
							agentId,
							timestamp: now.toISOString()
						});
					}

					// Always advance lastCheck so diffs aren't re-emitted
					lastCheck = now;
				} catch (err) {
					this.logger.warn('Index sync poll failed', {
						error: err instanceof Error ? err.message : String(err)
					});
				}

				await new Promise((resolve) => setTimeout(resolve, intervalMs));
			}
		};

		poll();

		return () => {
			stopped = true;
		};
	}

	// ── Sprint C: Missing Endpoint Coverage ──────────────────────────

	// C-1: Workflow Runs

	/** GET /api/orchestration/:id/runs — List runs for a workflow. */
	async listWorkflowRuns(workflowId: string, limit = 20): Promise<{ runs: WorkflowRun[] }> {
		const sp = new URLSearchParams({ limit: String(Math.min(limit, 100)) });
		return this.getJson(
			`/api/orchestration/${encodeURIComponent(workflowId)}/runs?${sp.toString()}`,
			'listWorkflowRuns'
		);
	}

	// C-2: Developer Key Management

	/** GET /api/developers/keys — List all API keys for the authenticated user. */
	async listDeveloperKeys(): Promise<{ keys: DeveloperApiKey[] }> {
		return this.getJson('/api/developers/keys', 'listDeveloperKeys');
	}

	/** POST /api/developers/keys — Generate a new developer API key. */
	async createDeveloperKey(req: CreateDeveloperKeyRequest): Promise<CreateDeveloperKeyResponse> {
		this.logger.debug('Creating developer key', { name: req.name });
		return this.postJson('/api/developers/keys', req, 'createDeveloperKey');
	}

	/** DELETE /api/developers/keys/:id — Revoke a developer API key. */
	async revokeDeveloperKey(keyId: string): Promise<RevokeDeveloperKeyResponse> {
		this.logger.debug('Revoking developer key', { keyId });
		return this.deleteJson(
			`/api/developers/keys/${encodeURIComponent(keyId)}`,
			'revokeDeveloperKey'
		);
	}

	// C-3: Agent Lifecycle (deprecate / tombstone / versions)

	/** POST /api/agents/:agentId/deprecate — Deprecate an agent with a grace period. */
	async deprecateAgent(agentId: string, req: DeprecateAgentRequest): Promise<DeprecateAgentResponse> {
		this.logger.debug('Deprecating agent', { agentId, reason: req.reason });
		return this.postJson(
			`/api/agents/${encodeURIComponent(agentId)}/deprecate`,
			req,
			'deprecateAgent'
		);
	}

	/** POST /api/agents/:agentId/tombstone — Permanently tombstone an agent. */
	async tombstoneAgent(agentId: string): Promise<TombstoneAgentResponse> {
		this.logger.debug('Tombstoning agent', { agentId });
		return this.postJson(
			`/api/agents/${encodeURIComponent(agentId)}/tombstone`,
			{},
			'tombstoneAgent'
		);
	}

	/** GET /api/agents/:agentId/versions — List all versions for an agent. */
	async listAgentVersions(agentId: string): Promise<{ agent_id: string; count: number; versions: AgentVersion[] }> {
		return this.getJson(
			`/api/agents/${encodeURIComponent(agentId)}/versions`,
			'listAgentVersions'
		);
	}

	/** POST /api/agents/:agentId/versions — Create a new agent version. */
	async createAgentVersion(agentId: string, req: CreateAgentVersionRequest): Promise<{ status: string; version: AgentVersion }> {
		this.logger.debug('Creating agent version', { agentId, version: req.version });
		return this.postJson(
			`/api/agents/${encodeURIComponent(agentId)}/versions`,
			req,
			'createAgentVersion'
		);
	}

	// C-4: Compliance Scan

	/** POST /api/compliance/scan — Run a compliance scan for all agents. */
	async scanCompliance(): Promise<ComplianceScanResult> {
		this.logger.debug('Running compliance scan');
		return this.postJson('/api/compliance/scan', {}, 'scanCompliance');
	}

	// C-5: Trust Graph

	/** GET /api/trust/framework/graph?did= — Get trust graph edges for a DID. */
	async getTrustGraph(did: string): Promise<TrustGraphResponse> {
		const sp = new URLSearchParams({ did });
		return this.getJson(`/api/trust/framework/graph?${sp.toString()}`, 'getTrustGraph');
	}

	/** GET /api/trust/framework/graph?from=&to= — Compute trust path between two DIDs. */
	async getTrustPath(fromDid: string, toDid: string): Promise<TrustPathResponse> {
		const sp = new URLSearchParams({ from: fromDid, to: toDid });
		return this.getJson(`/api/trust/framework/graph?${sp.toString()}`, 'getTrustPath');
	}

	// C-6: Behavior Analytics

	/** GET /api/analytics/behavior — Get agent behavior analytics. */
	async getBehaviorAnalytics(
		agentId: string,
		options: { period?: 'daily' | 'weekly'; limit?: number } = {}
	): Promise<BehaviorAnalyticsResponse> {
		const sp = new URLSearchParams({ agent: agentId });
		if (options.period) sp.set('period', options.period);
		if (options.limit) sp.set('limit', String(options.limit));
		return this.getJson(`/api/analytics/behavior?${sp.toString()}`, 'getBehaviorAnalytics');
	}

	// C-7: NP Payment Verification

	/** POST /api/payments/verify-np — Verify a Nanda Point payment. */
	async verifyNpPayment(req: VerifyNpPaymentRequest): Promise<VerifyNpPaymentResponse> {
		this.logger.debug('Verifying NP payment', { agent: req.agent, tx_id: req.tx_id });
		return this.postJson('/api/payments/verify-np', req, 'verifyNpPayment');
	}
}



