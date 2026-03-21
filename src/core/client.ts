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
	EarningsActionRequest
} from './types';

import { fetchWithRetry } from './retry';
import { createNnnLogger, type NnnLogger } from './logger';
import { NnnError, NnnErrorCode } from './errors';

/** SDK version constant — derived from package.json at build time. */
export const SDK_VERSION = '1.0.0';

// ── Circuit Breaker ─────────────────────────────────────────────

interface CircuitBreakerState {
	failures: number;
	lastFailureTime: number;
	state: 'closed' | 'open' | 'half-open';
}

const DEFAULT_CIRCUIT_BREAKER: Required<NnnCircuitBreakerConfig> = {
	failureThreshold: 5,
	cooldownMs: 30_000
};

export class NnnClient {
	readonly baseUrl: string;
	private apiKey: string | null;
	private logger: NnnLogger;
	private retryConfig: NnnConfig['retryConfig'];
	private hooks: NnnHooks;
	private traceContext: { traceparent?: string; tracestate?: string };
	private circuitBreakerConfig: Required<NnnCircuitBreakerConfig> | null;
	private circuitBreaker: CircuitBreakerState;

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

		if (config.circuitBreaker === false) {
			this.circuitBreakerConfig = null;
		} else {
			this.circuitBreakerConfig = { ...DEFAULT_CIRCUIT_BREAKER, ...config.circuitBreaker };
		}
		this.circuitBreaker = { failures: 0, lastFailureTime: 0, state: 'closed' };
	}

	// ── HTTP helpers ──────────────────────────────────────────────────

	private headers(): Record<string, string> {
		const h: Record<string, string> = {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'User-Agent': `NNN-SDK/${SDK_VERSION}`
		};
		if (this.apiKey) h['Authorization'] = `Bearer ${this.apiKey}`;
		// OpenTelemetry trace context propagation (2.2)
		if (this.traceContext.traceparent) h['traceparent'] = this.traceContext.traceparent;
		if (this.traceContext.tracestate) h['tracestate'] = this.traceContext.tracestate;
		return h;
	}

	/** Update trace context for subsequent requests. */
	setTraceContext(ctx: { traceparent?: string; tracestate?: string }): void {
		this.traceContext = ctx;
	}

	// ── Circuit Breaker Logic ───────────────────────────────────────

	private checkCircuitBreaker(): void {
		if (!this.circuitBreakerConfig) return;
		const cb = this.circuitBreaker;
		const cfg = this.circuitBreakerConfig;

		if (cb.state === 'open') {
			const elapsed = Date.now() - cb.lastFailureTime;
			if (elapsed >= cfg.cooldownMs) {
				cb.state = 'half-open';
				this.logger.debug('Circuit breaker half-open, allowing probe request');
			} else {
				throw new NnnError(
					NnnErrorCode.NETWORK_ERROR,
					`Circuit breaker is open. ${cfg.cooldownMs - elapsed}ms remaining in cooldown.`
				);
			}
		}
	}

	private recordSuccess(): void {
		if (!this.circuitBreakerConfig) return;
		this.circuitBreaker.failures = 0;
		this.circuitBreaker.state = 'closed';
	}

	private recordFailure(): void {
		if (!this.circuitBreakerConfig) return;
		const cb = this.circuitBreaker;
		const cfg = this.circuitBreakerConfig;
		cb.failures++;
		cb.lastFailureTime = Date.now();

		if (cb.failures >= cfg.failureThreshold) {
			cb.state = 'open';
			this.logger.warn('Circuit breaker tripped', { failures: cb.failures, cooldownMs: cfg.cooldownMs });
		}
	}

	private async fetch(url: string, init: RequestInit, context: string): Promise<Response> {
		this.checkCircuitBreaker();

		await this.hooks.beforeRequest?.(url, init);
		const startTime = Date.now();

		try {
			const response = await fetchWithRetry(url, init, context, this.retryConfig);
			const durationMs = Date.now() - startTime;

			this.recordSuccess();
			await this.hooks.afterResponse?.(url, response, durationMs);

			return response;
		} catch (err) {
			const durationMs = Date.now() - startTime;
			this.recordFailure();
			await this.hooks.onError?.(url, err);

			// Enrich NnnError with duration context
			if (err instanceof NnnError) {
				err.context.durationMs = durationMs;
			}
			throw err;
		}
	}

	/**
	 * GET JSON helper — fetch + parse + error handling.
	 */
	private async getJson<T>(path: string, ctx: string): Promise<T> {
		const res = await this.fetch(`${this.baseUrl}${path}`, { headers: this.headers() }, ctx);
		if (!res.ok) {
			throw NnnError.fromStatus(res.status, `${ctx} failed (${res.status}): ${await res.text()}`);
		}
		return res.json() as Promise<T>;
	}

	/**
	 * POST JSON helper — fetch + parse + error handling.
	 */
	private async postJson<T>(path: string, body: unknown, ctx: string): Promise<T> {
		const res = await this.fetch(
			`${this.baseUrl}${path}`,
			{ method: 'POST', headers: this.headers(), body: JSON.stringify(body) },
			ctx
		);
		if (!res.ok) {
			throw NnnError.fromStatus(res.status, `${ctx} failed (${res.status}): ${await res.text()}`);
		}
		return res.json() as Promise<T>;
	}

	/**
	 * PUT JSON helper — fetch + parse + error handling.
	 */
	private async putJson<T>(path: string, body: unknown, ctx: string): Promise<T> {
		const res = await this.fetch(
			`${this.baseUrl}${path}`,
			{ method: 'PUT', headers: this.headers(), body: JSON.stringify(body) },
			ctx
		);
		if (!res.ok) {
			throw NnnError.fromStatus(res.status, `${ctx} failed (${res.status}): ${await res.text()}`);
		}
		return res.json() as Promise<T>;
	}

	/**
	 * DELETE JSON helper — fetch + parse + error handling.
	 */
	private async deleteJson<T>(path: string, ctx: string): Promise<T> {
		const res = await this.fetch(
			`${this.baseUrl}${path}`,
			{ method: 'DELETE', headers: this.headers() },
			ctx
		);
		if (!res.ok) {
			throw NnnError.fromStatus(res.status, `${ctx} failed (${res.status}): ${await res.text()}`);
		}
		return res.json() as Promise<T>;
	}

	/**
	 * PATCH JSON helper — fetch + parse + error handling.
	 */
	private async patchJson<T>(path: string, body: unknown, ctx: string): Promise<T> {
		const res = await this.fetch(
			`${this.baseUrl}${path}`,
			{ method: 'PATCH', headers: this.headers(), body: JSON.stringify(body) },
			ctx
		);
		if (!res.ok) {
			throw NnnError.fromStatus(res.status, `${ctx} failed (${res.status}): ${await res.text()}`);
		}
		return res.json() as Promise<T>;
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
			healthy: h.status === 'ok',
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
		const qs = sp.toString();
		return this.getJson(`/search${qs ? `?${qs}` : ''}`, 'searchAgents');
	}

	/** GET /list — List all registered agents. */
	async listAgents(): Promise<NnnAgent[]> {
		return this.getJson('/list', 'listAgents');
	}

	// ── Pagination Iterators ─────────────────────────────────────────

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
			const page: PaginatedResponse<NnnAgent> = await this.getJson(
				`/search${qs ? `?${qs}` : ''}`,
				'searchAgentsAll'
			);

			for (const agent of page.data) {
				yield agent;
			}

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
			const page: PaginatedResponse<NnnAgent> = await this.getJson(
				`/list${qs ? `?${qs}` : ''}`,
				'listAgentsAll'
			);

			for (const agent of page.data) {
				yield agent;
			}

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

	/** GET /api/orchestration?ownerId=&status= — List workflows. */
	async listWorkflows(params: { ownerId?: string; status?: string } = {}): Promise<{ workflows: WorkflowRecord[] }> {
		const sp = new URLSearchParams();
		if (params.ownerId) sp.set('ownerId', params.ownerId);
		if (params.status) sp.set('status', params.status);
		const qs = sp.toString();
		return this.getJson(`/api/orchestration${qs ? `?${qs}` : ''}`, 'listWorkflows');
	}

	/** POST /api/orchestration/:id/run — Run a workflow by ID. */
	async runWorkflow(workflowId: string, input?: Record<string, unknown>): Promise<WorkflowRunResult> {
		this.logger.debug('Running workflow', { workflowId });
		return this.postJson(
			`/api/orchestration/${encodeURIComponent(workflowId)}/run`,
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
		const headers: Record<string, string> = { ...this.headers() };
		if (adminKey) headers['Authorization'] = `Bearer ${adminKey}`;
		const res = await this.fetch(
			`${this.baseUrl}/api/trust/cross-registry`,
			{ method: 'POST', headers, body: JSON.stringify({}) },
			'syncCrossRegistryTrust'
		);
		if (!res.ok) {
			throw NnnError.fromStatus(res.status, `syncCrossRegistryTrust failed (${res.status}): ${await res.text()}`);
		}
		return res.json() as Promise<Record<string, unknown>>;
	}

	// ── Billing & Subscriptions ─────────────────────────────────────

	/** GET /api/subscriptions?keyId= — Get subscription for a key. */
	async getSubscription(keyId: string): Promise<Record<string, unknown>> {
		return this.getJson(`/api/subscriptions?keyId=${encodeURIComponent(keyId)}`, 'getSubscription');
	}

	/** POST /api/subscriptions — Create a new subscription. */
	async createSubscription(params: CreateSubscriptionRequest): Promise<Record<string, unknown>> {
		return this.postJson('/api/subscriptions', params, 'createSubscription');
	}

	/** GET /api/invoices?keyId= — List invoices for a key. */
	async listInvoices(keyId: string): Promise<Record<string, unknown>> {
		return this.getJson(`/api/invoices?keyId=${encodeURIComponent(keyId)}`, 'listInvoices');
	}

	/** POST /api/invoices — Create a new invoice. */
	async createInvoice(params: CreateInvoiceRequest): Promise<Record<string, unknown>> {
		return this.postJson('/api/invoices', params, 'createInvoice');
	}

	// ── Checkout Sessions ───────────────────────────────────────────

	/** POST /api/ucp/checkout-sessions — Create a checkout session. */
	async createCheckoutSession(params: CreateCheckoutRequest): Promise<CheckoutSession> {
		return this.postJson('/api/ucp/checkout-sessions', params, 'createCheckoutSession');
	}

	/** GET /api/ucp/checkout-sessions?id= — Get a checkout session. */
	async getCheckoutSession(sessionId: string): Promise<CheckoutSession> {
		return this.getJson(`/api/ucp/checkout-sessions?id=${encodeURIComponent(sessionId)}`, 'getCheckoutSession');
	}

	/** PATCH /api/ucp/checkout-sessions/:id — Submit payment for a checkout session. */
	async submitCheckoutPayment(sessionId: string, payment: Record<string, unknown>): Promise<Record<string, unknown>> {
		return this.patchJson(`/api/ucp/checkout-sessions/${encodeURIComponent(sessionId)}`, { payment }, 'submitCheckoutPayment');
	}

	/** DELETE /api/ucp/checkout-sessions/:id — Cancel a checkout session. */
	async cancelCheckoutSession(sessionId: string): Promise<{ id: string; status: string }> {
		return this.deleteJson(`/api/ucp/checkout-sessions/${encodeURIComponent(sessionId)}`, 'cancelCheckoutSession');
	}

	// ── Webhooks ────────────────────────────────────────────────────

	/** GET /api/webhooks — List webhook subscriptions. */
	async listWebhooks(): Promise<{ subscriptions: WebhookSubscription[] }> {
		return this.getJson('/api/webhooks', 'listWebhooks');
	}

	/** POST /api/webhooks — Create a webhook subscription. */
	async createWebhook(params: CreateWebhookRequest): Promise<CreateWebhookResponse> {
		return this.postJson('/api/webhooks', params, 'createWebhook');
	}

	/** GET /api/webhooks/:id — Get a single webhook subscription. */
	async getWebhook(webhookId: string): Promise<{ subscription: WebhookSubscription }> {
		return this.getJson(`/api/webhooks/${encodeURIComponent(webhookId)}`, 'getWebhook');
	}

	/** PATCH /api/webhooks/:id — Update a webhook (pause/resume). */
	async updateWebhook(webhookId: string, action: 'pause' | 'resume'): Promise<Record<string, unknown>> {
		return this.patchJson(`/api/webhooks/${encodeURIComponent(webhookId)}`, { action }, 'updateWebhook');
	}

	/** DELETE /api/webhooks/:id — Delete a webhook subscription. */
	async deleteWebhook(webhookId: string): Promise<{ ok: boolean; deleted: string }> {
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
			id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
			method: params.method,
			params: params.params
		};

		this.logger.debug('Sending A2A request', {
			targetAgentId: params.target_agent_id,
			method: params.method
		});

		const res = await this.fetch(
			targetUrl,
			{ method: 'POST', headers: this.headers(), body: JSON.stringify(rpcRequest) },
			'sendA2ARequest'
		);
		if (!res.ok) {
			throw NnnError.fromStatus(res.status, `sendA2ARequest failed (${res.status}): ${await res.text()}`);
		}
		return res.json() as Promise<A2AResponse>;
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
			id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
			method: params.method,
			params: params.params
		};

		this.logger.debug('Streaming A2A request', {
			targetAgentId: params.target_agent_id,
			method: params.method
		});

		const headers = { ...this.headers(), Accept: 'text/event-stream' };
		const res = await this.fetch(
			targetUrl,
			{ method: 'POST', headers, body: JSON.stringify(rpcRequest) },
			'streamA2ARequest'
		);
		if (!res.ok) {
			throw NnnError.fromStatus(res.status, `streamA2ARequest failed (${res.status}): ${await res.text()}`);
		}

		if (!res.body) {
			throw new NnnError(NnnErrorCode.NETWORK_ERROR, 'streamA2ARequest: response body is null');
		}

		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed || trimmed.startsWith(':')) continue;
					if (trimmed.startsWith('data: ')) {
						const data = trimmed.slice(6);
						if (data === '[DONE]') return;
						try {
							yield JSON.parse(data) as A2AResponse;
						} catch {
							this.logger.warn('Failed to parse SSE data', { data });
						}
					}
				}
			}
		} finally {
			reader.releaseLock();
		}
	}

	// ── 1.2 Agent Lifecycle Management ──────────────────────────────

	/** PUT /api/agents/:id — Update an existing agent. */
	async updateAgent(agentId: string, updates: UpdateAgentRequest): Promise<NnnAgent> {
		this.logger.debug('Updating agent', { agentId });
		return this.putJson(`/api/agents/${encodeURIComponent(agentId)}`, updates, 'updateAgent');
	}

	/** DELETE /api/agents/:id — Delete an agent from the registry. */
	async deleteAgent(agentId: string): Promise<{ status: string; message: string }> {
		this.logger.debug('Deleting agent', { agentId });
		return this.deleteJson(`/api/agents/${encodeURIComponent(agentId)}`, 'deleteAgent');
	}

	/** POST /api/agents/:id/refresh — Re-crawl an agent's card. */
	async refreshAgent(agentId: string): Promise<AgentRefreshResult> {
		this.logger.debug('Refreshing agent', { agentId });
		return this.postJson(`/api/agents/${encodeURIComponent(agentId)}/refresh`, {}, 'refreshAgent');
	}

	// ── 1.3 Routing Engine ──────────────────────────────────────────

	/** POST /api/routing — Route a request to the best-matching agent. */
	async routeRequest(params: RouteRequestParams): Promise<RoutingResult> {
		this.logger.debug('Routing request', { skill: params.skill, strategy: params.strategy });
		return this.postJson('/api/routing', params, 'routeRequest');
	}

	// ── 1.4 Workflow Execution & Monitoring ─────────────────────────

	/** GET /api/orchestration/:workflowId/runs/:runId — Get workflow run status. */
	async getWorkflowStatus(workflowId: string, runId: string): Promise<WorkflowRunStatus> {
		return this.getJson(
			`/api/orchestration/${encodeURIComponent(workflowId)}/runs/${encodeURIComponent(runId)}`,
			'getWorkflowStatus'
		);
	}

	/** POST /api/orchestration/:workflowId/runs/:runId/cancel — Cancel an in-progress run. */
	async cancelWorkflowRun(workflowId: string, runId: string): Promise<{ status: string; message: string }> {
		this.logger.debug('Cancelling workflow run', { workflowId, runId });
		return this.postJson(
			`/api/orchestration/${encodeURIComponent(workflowId)}/runs/${encodeURIComponent(runId)}/cancel`,
			{},
			'cancelWorkflowRun'
		);
	}

	/**
	 * SSE stream for real-time workflow execution events.
	 * Yields parsed event objects as they arrive.
	 */
	async *streamWorkflowEvents(workflowId: string, runId: string): AsyncGenerator<Record<string, unknown>, void, unknown> {
		const url = `${this.baseUrl}/api/orchestration/${encodeURIComponent(workflowId)}/runs/${encodeURIComponent(runId)}/events`;
		const headers = { ...this.headers(), Accept: 'text/event-stream' };

		const res = await this.fetch(url, { headers }, 'streamWorkflowEvents');
		if (!res.ok) {
			throw NnnError.fromStatus(res.status, `streamWorkflowEvents failed (${res.status}): ${await res.text()}`);
		}

		if (!res.body) {
			throw new NnnError(NnnErrorCode.NETWORK_ERROR, 'streamWorkflowEvents: response body is null');
		}

		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed || trimmed.startsWith(':')) continue;
					if (trimmed.startsWith('data: ')) {
						const data = trimmed.slice(6);
						if (data === '[DONE]') return;
						try {
							yield JSON.parse(data) as Record<string, unknown>;
						} catch {
							this.logger.warn('Failed to parse SSE event', { data });
						}
					}
				}
			}
		} finally {
			reader.releaseLock();
		}
	}

	// ── 1.5 NANDA Index Sync ────────────────────────────────────────

	/** GET /api/index/diff?since= — Get agents added/removed/updated since a timestamp. */
	async diffIndex(since: Date): Promise<IndexDiffResult> {
		const sp = new URLSearchParams({ since: since.toISOString() });
		return this.getJson(`/api/index/diff?${sp.toString()}`, 'diffIndex');
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
						callback({ type: 'added', agent, timestamp: now.toISOString() });
					}
					for (const agent of diff.updated) {
						callback({ type: 'updated', agent, timestamp: now.toISOString() });
					}
					for (const agentId of diff.removed) {
						callback({
							type: 'removed',
							agent: { agent_id: agentId, agent_url: '' } as NnnAgent,
							timestamp: now.toISOString()
						});
					}

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
}



