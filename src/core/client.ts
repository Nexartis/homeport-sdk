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
	PaginatedResponse
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

