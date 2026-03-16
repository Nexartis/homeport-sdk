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
	CreateWorkflowRequest
} from './types';

import { fetchWithRetry } from './retry';
import { createNnnLogger, type NnnLogger } from './logger';
import { NnnError, NnnErrorCode } from './errors';

export class NnnClient {
	readonly baseUrl: string;
	private apiKey: string | null;
	private logger: NnnLogger;
	private retryConfig: NnnConfig['retryConfig'];

	constructor(config: NnnConfig) {
		if (!config.baseUrl) {
			throw new NnnError(NnnErrorCode.CONFIGURATION_ERROR, 'NnnClient requires config.baseUrl');
		}
		this.baseUrl = config.baseUrl.replace(/\/+$/, '');
		this.apiKey = config.apiKey ?? null;
		this.logger = createNnnLogger(config.verbose ?? false);
		this.retryConfig = config.retryConfig;
	}

	// ── HTTP helpers ──────────────────────────────────────────────────

	private headers(): Record<string, string> {
		const h: Record<string, string> = {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'User-Agent': 'NNN-SDK/1.0'
		};
		if (this.apiKey) h['Authorization'] = `Bearer ${this.apiKey}`;
		return h;
	}

	private fetch(url: string, init: RequestInit, context: string): Promise<Response> {
		return fetchWithRetry(url, init, context, this.retryConfig);
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
}

