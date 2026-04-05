/**
 * NNN SDK — Switchboard Namespace
 *
 * Accessed via `client.switchboard.*`.
 * Covers protocol auto-discovery, adapter management, resync, and export.
 *
 * @module core/namespaces/switchboard
 */

import type { NnnClientInternals } from '../namespace-helpers.js';
import type {
	SwitchboardDiscoverRequest,
	SwitchboardLookupResult,
	SwitchboardExportRequest,
	SwitchboardExportResponse,
	SwitchboardResyncRequest,
	SwitchboardResyncResponse,
	SwitchboardAdaptersResponse,
	ProtocolAdapterRecord
} from '../types.js';

export class SwitchboardNamespace {
	/** @internal */
	constructor(private readonly _client: NnnClientInternals) {}

	/**
	 * POST /api/switchboard/discover — Auto-discover agent protocols from a URL.
	 *
	 * Probes the URL for supported protocols (A2A, MCP, NLWeb, NANDA),
	 * extracts agent metadata, and registers protocol adapters.
	 */
	async discover(req: SwitchboardDiscoverRequest): Promise<SwitchboardLookupResult> {
		this._client.logger.debug('Discovering agent protocols', { url: req.url });
		return this._client.postJson('/api/switchboard/discover', req, 'switchboard.discover');
	}

	/**
	 * GET /api/switchboard/adapters/:agent_id — List protocol adapters for an agent.
	 *
	 * Returns all protocol adapters registered for the given agent,
	 * showing which protocols were detected and their metadata.
	 */
	async getAdapters(agentId: string): Promise<SwitchboardAdaptersResponse> {
		return this._client.getJson(
			`/api/switchboard/adapters/${encodeURIComponent(agentId)}`,
			'switchboard.getAdapters'
		);
	}

	/**
	 * POST /api/switchboard/resync — Re-probe and update protocol adapters for an agent.
	 *
	 * Deletes existing adapters, re-probes the agent's URL, and registers
	 * newly detected protocol adapters.
	 */
	async resync(req: SwitchboardResyncRequest): Promise<SwitchboardResyncResponse> {
		this._client.logger.debug('Resyncing agent adapters', { agentId: req.agent_id });
		return this._client.postJson('/api/switchboard/resync', req, 'switchboard.resync');
	}

	/**
	 * POST /api/switchboard/export — Export agent metadata to a target protocol format.
	 *
	 * Converts an agent's AgentFacts v2 data to A2A Agent Card, MCP descriptor,
	 * or NLWeb descriptor format.
	 */
	async export(req: SwitchboardExportRequest): Promise<SwitchboardExportResponse> {
		this._client.logger.debug('Exporting agent metadata', {
			agentId: req.agent_id,
			targetProtocol: req.target_protocol
		});
		return this._client.postJson('/api/switchboard/export', req, 'switchboard.export');
	}

	// ── A2A Typed Actions ────────────────────────────────────────────

	/**
	 * A2A action: `switchboard.discover` — Discover protocols at a URL via JSON-RPC.
	 * Convenience wrapper around `federation.sendA2ARequest()`.
	 */
	async a2aDiscover(
		targetAgentId: string,
		url: string,
		targetUrl?: string
	): Promise<SwitchboardLookupResult> {
		return this._client.postJson('/a2a', {
			jsonrpc: '2.0',
			id: Date.now().toString(),
			method: 'switchboard.discover',
			params: { url }
		}, 'switchboard.a2aDiscover') as Promise<SwitchboardLookupResult>;
	}

	/**
	 * A2A action: `switchboard.adapters` — List adapters for an agent via JSON-RPC.
	 */
	async a2aAdapters(
		agentId: string
	): Promise<{ agent_id: string; adapters: ProtocolAdapterRecord[] }> {
		return this._client.postJson('/a2a', {
			jsonrpc: '2.0',
			id: Date.now().toString(),
			method: 'switchboard.adapters',
			params: { agent_id: agentId }
		}, 'switchboard.a2aAdapters') as Promise<{ agent_id: string; adapters: ProtocolAdapterRecord[] }>;
	}
}
