// SPDX-License-Identifier: Apache-2.0
/**
 * Homeport SDK — Agents Namespace
 *
 * Accessed via `client.agents.*`.
 * Covers registration, lookup, search, lifecycle, facts, and versioning.
 *
 * @module core/namespaces/agents
 */

import type { HomeportClientInternals } from '../namespace-helpers.js';
import type {
	HomeportAgent,
	RegisterAgentRequest,
	RegisterAgentResponse,
	SearchAgentsParams,
	AgentFacts,
	AgentCard,
	NandaIndex,
	UpdateAgentRequest,
	AgentRefreshResult,
	PaginatedResponse,
	DeprecateAgentRequest,
	DeprecateAgentResponse,
	TombstoneAgentResponse,
	AgentVersion,
	CreateAgentVersionRequest
} from '../types.js';

export class AgentsNamespace {
	/** @internal */
	constructor(private readonly _client: HomeportClientInternals) {}

	// ── Registration & Lookup ──────────────────────────────────────

	/** POST /register — Register an agent on the NANDA network. */
	async register(req: RegisterAgentRequest): Promise<RegisterAgentResponse> {
		this._client.logger.debug('Registering agent', { agentId: req.agent_id });
		return this._client.postJson('/register', req, 'agents.register');
	}

	/** GET /lookup/:id — Lookup a single agent by ID. */
	async lookup(agentId: string): Promise<HomeportAgent> {
		return this._client.getJson(`/lookup/${encodeURIComponent(agentId)}`, 'agents.lookup');
	}

	/** GET /search?q=&capabilities=&tags=&visibility=&for_hire= — Search agents. */
	async search(params: SearchAgentsParams = {}): Promise<HomeportAgent[]> {
		const sp = new URLSearchParams();
		if (params.q) sp.set('q', params.q);
		if (params.capabilities?.length) sp.set('capabilities', params.capabilities.join(','));
		if (params.tags?.length) sp.set('tags', params.tags.join(','));
		if (params.min_trust !== undefined) sp.set('min_trust', String(params.min_trust));
		if (params.jurisdiction) sp.set('jurisdiction', params.jurisdiction);
		if (params.protocol) sp.set('protocol', params.protocol);
		if (params.visibility) sp.set('visibility', params.visibility);
		if (params.for_hire !== undefined) sp.set('for_hire', String(params.for_hire));
		if (params.limit !== undefined) sp.set('limit', String(params.limit));
		if (params.cursor) sp.set('cursor', params.cursor);
		const qs = sp.toString();
		return this._client.getJson(`/search${qs ? `?${qs}` : ''}`, 'agents.search');
	}

	/** GET /list — List all registered agents. */
	async list(): Promise<HomeportAgent[]> {
		return this._client.getJson('/list', 'agents.list');
	}

	// ── Pagination Iterators ─────────────────────────────────────

	private normalizePage<T>(raw: T[] | PaginatedResponse<T>): PaginatedResponse<T> {
		if (Array.isArray(raw)) return { data: raw, hasMore: false, cursor: undefined };
		return raw;
	}

	/** Auto-paginating search — yields agents one at a time across all pages. */
	async *searchAll(params: SearchAgentsParams = {}): AsyncGenerator<HomeportAgent> {
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
			if (params.visibility) sp.set('visibility', params.visibility);
			if (params.for_hire !== undefined) sp.set('for_hire', String(params.for_hire));
			if (params.limit !== undefined) sp.set('limit', String(params.limit));
			if (cursor) sp.set('cursor', cursor);
			const qs = sp.toString();
			const raw = await this._client.getJson<HomeportAgent[] | PaginatedResponse<HomeportAgent>>(
				`/search${qs ? `?${qs}` : ''}`, 'agents.searchAll'
			);
			const page = this.normalizePage(raw);
			for (const agent of page.data) yield agent;
			if (page.hasMore && page.cursor === cursor) break;
			cursor = page.cursor;
			hasMore = page.hasMore;
		}
	}

	/** Auto-paginating list — yields all registered agents across pages. */
	async *listAll(params: { limit?: number; cursor?: string } = {}): AsyncGenerator<HomeportAgent> {
		let cursor: string | undefined = params.cursor;
		let hasMore = true;
		while (hasMore) {
			const sp = new URLSearchParams();
			if (params.limit !== undefined) sp.set('limit', String(params.limit));
			if (cursor) sp.set('cursor', cursor);
			const qs = sp.toString();
			const raw = await this._client.getJson<HomeportAgent[] | PaginatedResponse<HomeportAgent>>(
				`/list${qs ? `?${qs}` : ''}`, 'agents.listAll'
			);
			const page = this.normalizePage(raw);
			for (const agent of page.data) yield agent;
			if (page.hasMore && page.cursor === cursor) break;
			cursor = page.cursor;
			hasMore = page.hasMore;
		}
	}

	// ── Facts & Card ─────────────────────────────────────────────

	/** GET /agentfacts/:id — Get agent facts. */
	async getFacts(agentId: string): Promise<AgentFacts> {
		return this._client.getJson(`/agentfacts/${encodeURIComponent(agentId)}`, 'agents.getFacts');
	}

	/** GET /.well-known/agent-card.json — Get the node's own A2A agent card. */
	async getCard(): Promise<AgentCard> {
		return this._client.getJson('/.well-known/agent-card.json', 'agents.getCard');
	}

	/** GET /.well-known/nanda-index — Get the NANDA index descriptor. */
	async getNandaIndex(): Promise<NandaIndex> {
		return this._client.getJson('/.well-known/nanda-index', 'agents.getNandaIndex');
	}

	// ── Lifecycle ────────────────────────────────────────────────

	/** PUT /agents/:id — Update an existing agent. */
	async update(agentId: string, updates: UpdateAgentRequest): Promise<HomeportAgent> {
		this._client.logger.debug('Updating agent', { agentId });
		return this._client.putJson(`/agents/${encodeURIComponent(agentId)}`, updates, 'agents.update');
	}

	/** PUT /agents/:id/status — Update an agent's status and capabilities. */
	async updateStatus(agentId: string, status: string, capabilities?: string[]): Promise<{ status: string }> {
		this._client.logger.debug('Updating agent status', { agentId, status });
		return this._client.putJson(`/agents/${encodeURIComponent(agentId)}/status`, { status, capabilities }, 'agents.updateStatus');
	}

	/** DELETE /agents/:id — Delete an agent from the registry. */
	async delete(agentId: string): Promise<{ status: string }> {
		this._client.logger.debug('Deleting agent', { agentId });
		return this._client.deleteJson(`/agents/${encodeURIComponent(agentId)}`, 'agents.delete');
	}

	/** POST /agents/:id/refresh — Re-crawl an agent's card and update facts. */
	async refresh(agentId: string): Promise<AgentRefreshResult> {
		this._client.logger.debug('Refreshing agent', { agentId });
		return this._client.postJson(`/agents/${encodeURIComponent(agentId)}/refresh`, {}, 'agents.refresh');
	}

	/** POST /api/agents/:agentId/deprecate — Deprecate an agent with a grace period. */
	async deprecate(agentId: string, req: DeprecateAgentRequest): Promise<DeprecateAgentResponse> {
		this._client.logger.debug('Deprecating agent', { agentId, reason: req.reason });
		return this._client.postJson(`/api/agents/${encodeURIComponent(agentId)}/deprecate`, req, 'agents.deprecate');
	}

	/** POST /api/agents/:agentId/tombstone — Permanently tombstone an agent. */
	async tombstone(agentId: string): Promise<TombstoneAgentResponse> {
		this._client.logger.debug('Tombstoning agent', { agentId });
		return this._client.postJson(`/api/agents/${encodeURIComponent(agentId)}/tombstone`, {}, 'agents.tombstone');
	}

	/** GET /api/agents/:agentId/versions — List all versions for an agent. */
	async listVersions(agentId: string): Promise<{ agent_id: string; count: number; versions: AgentVersion[] }> {
		return this._client.getJson(`/api/agents/${encodeURIComponent(agentId)}/versions`, 'agents.listVersions');
	}

	/** POST /api/agents/:agentId/versions — Create a new agent version. */
	async createVersion(agentId: string, req: CreateAgentVersionRequest): Promise<{ status: string; version: AgentVersion }> {
		this._client.logger.debug('Creating agent version', { agentId, version: req.version });
		return this._client.postJson(`/api/agents/${encodeURIComponent(agentId)}/versions`, req, 'agents.createVersion');
	}
}

