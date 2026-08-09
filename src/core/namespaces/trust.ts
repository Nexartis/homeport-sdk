// SPDX-License-Identifier: Apache-2.0
/**
 * Homeport SDK — Trust Namespace
 *
 * Accessed via `client.trust.*`.
 * Covers resolution, reputation, trust scores/frameworks/graph, compliance, and analytics.
 *
 * @module core/namespaces/trust
 */

import type { HomeportClientInternals } from '../namespace-helpers.js';
import type {
	AgentAddr,
	ResolutionContext,
	ResolutionResult,
	ReputationEntry,
	TrustScoresOptions,
	TrustFrameworksOptions,
	ComplianceScanResult,
	TrustGraphResponse,
	TrustPathResponse,
	BehaviorAnalyticsResponse,
	TrustBadgeResponse
} from '../types.js';

export class TrustNamespace {
	/** @internal */
	constructor(private readonly _client: HomeportClientInternals) {}

	// ── Resolution ──────────────────────────────────────────────

	/** GET /resolve/:agent_id — Resolve an agent to its address record. */
	async resolveAgent(agentId: string): Promise<AgentAddr> {
		return this._client.getJson(`/resolve/${encodeURIComponent(agentId)}`, 'trust.resolveAgent');
	}

	/** POST /resolve — Adaptive resolution with context-aware ranking. */
	async adaptiveResolve(agentId: string, context?: ResolutionContext): Promise<ResolutionResult> {
		this._client.logger.debug('Adaptive resolve', { agentId });
		return this._client.postJson('/resolve', { agent_id: agentId, context }, 'trust.adaptiveResolve');
	}

	// ── Reputation & Scores ─────────────────────────────────────

	/** GET /reputation — Get reputation scores for all agents. */
	async getReputation(): Promise<{ agents: ReputationEntry[]; total: number; fetchedAt: string }> {
		return this._client.getJson('/reputation', 'trust.getReputation');
	}

	/** GET /api/trust/scores — Get trust scores. */
	async getScores(options: TrustScoresOptions = {}): Promise<Record<string, unknown>> {
		const sp = new URLSearchParams();
		if (options.agent) sp.set('agent', options.agent);
		if (options.offset !== undefined) sp.set('offset', String(options.offset));
		if (options.limit !== undefined) sp.set('limit', String(options.limit));
		const qs = sp.toString();
		return this._client.getJson(`/api/trust/scores${qs ? `?${qs}` : ''}`, 'trust.getScores');
	}

	/** GET /api/trust/framework — Get trust frameworks. */
	async getFrameworks(options: TrustFrameworksOptions = {}): Promise<Record<string, unknown>> {
		const sp = new URLSearchParams();
		if (options.id) sp.set('id', options.id);
		const qs = sp.toString();
		return this._client.getJson(`/api/trust/framework${qs ? `?${qs}` : ''}`, 'trust.getFrameworks');
	}

	/** POST /api/trust/cross-registry — Sync trust scores across federated registries. */
	async syncCrossRegistry(adminKey?: string): Promise<Record<string, unknown>> {
		this._client.logger.debug('Syncing cross-registry trust');
		const headers: Record<string, string> = { ...this._client.headers() };
		if (adminKey) headers['Authorization'] = `Bearer ${adminKey}`;
		const requestUrl = `${this._client.baseUrl}/api/trust/cross-registry`;
		const res = await this._client.fetch(
			requestUrl,
			{ method: 'POST', headers, body: JSON.stringify({}) },
			'trust.syncCrossRegistry'
		);
		return this._client.safeParseJson<Record<string, unknown>>(res, 'trust.syncCrossRegistry', false, requestUrl);
	}

	// ── Trust Badges ────────────────────────────────────────────

	/** GET /trust/badges — Get trust badges computed from reputation data. */
	async getBadges(agentId?: string): Promise<TrustBadgeResponse> {
		const sp = new URLSearchParams();
		if (agentId) sp.set('agent', agentId);
		const qs = sp.toString();
		return this._client.getJson(`/trust/badges${qs ? `?${qs}` : ''}`, 'trust.getBadges');
	}

	// ── Graph ───────────────────────────────────────────────────

	/** GET /api/trust/framework/graph?did= — Get trust graph edges for a DID. */
	async getGraph(did: string): Promise<TrustGraphResponse> {
		const sp = new URLSearchParams({ did });
		return this._client.getJson(`/api/trust/framework/graph?${sp.toString()}`, 'trust.getGraph');
	}

	/** GET /api/trust/framework/graph?from=&to= — Compute trust path between two DIDs. */
	async getPath(fromDid: string, toDid: string): Promise<TrustPathResponse> {
		const sp = new URLSearchParams({ from: fromDid, to: toDid });
		return this._client.getJson(`/api/trust/framework/graph?${sp.toString()}`, 'trust.getPath');
	}

	// ── Compliance & Analytics ──────────────────────────────────

	/** POST /api/compliance/scan — Run a compliance scan for all agents. */
	async scanCompliance(): Promise<ComplianceScanResult> {
		this._client.logger.debug('Running compliance scan');
		return this._client.postJson('/api/compliance/scan', {}, 'trust.scanCompliance');
	}

	/** GET /api/analytics/behavior — Get agent behavior analytics. */
	async getBehaviorAnalytics(
		agentId: string,
		options: { period?: 'daily' | 'weekly'; limit?: number } = {}
	): Promise<BehaviorAnalyticsResponse> {
		const sp = new URLSearchParams({ agent: agentId });
		if (options.period) sp.set('period', options.period);
		if (options.limit) sp.set('limit', String(options.limit));
		return this._client.getJson(`/api/analytics/behavior?${sp.toString()}`, 'trust.getBehaviorAnalytics');
	}
}

