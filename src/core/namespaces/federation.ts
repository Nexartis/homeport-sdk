// SPDX-License-Identifier: Apache-2.0
/**
 * NNN SDK — Federation Namespace
 *
 * Accessed via `client.federation.*`.
 * Covers federation peers, status, agents, and A2A communication.
 *
 * @module core/namespaces/federation
 */

import type { NnnClientInternals } from '../namespace-helpers.js';
import type {
	SendA2ARequestParams,
	A2ARequest,
	A2AResponse
} from '../types.js';
import { NnnError, NnnErrorCode } from '../errors.js';
import { generateRequestId, parseSSEStream } from '../sse.js';

export class FederationNamespace {
	/** @internal */
	constructor(private readonly _client: NnnClientInternals) {}

	/** GET /federation/peers — Get federation peer list. */
	async getPeers(): Promise<Record<string, unknown>> {
		return this._client.getJson('/federation/peers', 'federation.getPeers');
	}

	/** GET /federation/status — Get federation status. */
	async getStatus(): Promise<Record<string, unknown>> {
		return this._client.getJson('/federation/status', 'federation.getStatus');
	}

	/** GET /federation/agents — Get federated agents. */
	async getAgents(): Promise<Record<string, unknown>> {
		return this._client.getJson('/federation/agents', 'federation.getAgents');
	}

	/**
	 * Send an A2A JSON-RPC request to a target agent.
	 * Auto-discovers the agent URL via lookupAgent() if target_url is not provided.
	 */
	async sendA2ARequest(params: SendA2ARequestParams): Promise<A2AResponse> {
		let targetUrl = params.target_url;
		if (!targetUrl) {
			const agent = await this._client.getJson<{ api_url?: string; agent_url?: string }>(
				`/lookup/${encodeURIComponent(params.target_agent_id)}`,
				'federation.sendA2ARequest.lookup'
			);
			targetUrl = agent.api_url ?? agent.agent_url;
			if (!targetUrl) {
				throw new NnnError(
					NnnErrorCode.CONFIGURATION_ERROR,
					`Agent ${params.target_agent_id} has no api_url or agent_url`
				);
			}
		}

		const rpcRequest: A2ARequest = {
			jsonrpc: '2.0',
			id: generateRequestId(),
			method: params.method,
			params: params.params
		};

		const res = await this._client.fetch(
			targetUrl,
			{
				method: 'POST',
				headers: this._client.externalHeaders(),
				body: JSON.stringify(rpcRequest)
			},
			'federation.sendA2ARequest',
			true // skipBreaker — external call
		);
		return this._client.safeParseJson<A2AResponse>(res, 'federation.sendA2ARequest', true, targetUrl);
	}

	/**
	 * Stream an A2A JSON-RPC request as SSE events.
	 * Auto-discovers the agent URL via lookupAgent() if target_url is not provided.
	 */
	async *streamA2ARequest(params: SendA2ARequestParams): AsyncGenerator<A2AResponse, void, unknown> {
		let targetUrl = params.target_url;
		if (!targetUrl) {
			const agent = await this._client.getJson<{ api_url?: string; agent_url?: string }>(
				`/lookup/${encodeURIComponent(params.target_agent_id)}`,
				'federation.streamA2ARequest.lookup'
			);
			targetUrl = agent.api_url ?? agent.agent_url;
			if (!targetUrl) {
				throw new NnnError(
					NnnErrorCode.CONFIGURATION_ERROR,
					`Agent ${params.target_agent_id} has no api_url or agent_url`
				);
			}
		}

		const rpcRequest: A2ARequest = {
			jsonrpc: '2.0',
			id: generateRequestId(),
			method: params.method,
			params: params.params
		};

		const res = await this._client.fetch(
			targetUrl,
			{
				method: 'POST',
				headers: { ...this._client.externalHeaders(), Accept: 'text/event-stream' },
				body: JSON.stringify(rpcRequest)
			},
			'federation.streamA2ARequest',
			true
		);

		if (!res.body) {
			throw new NnnError(NnnErrorCode.NETWORK_ERROR, 'federation.streamA2ARequest: response body is null');
		}

		yield* parseSSEStream<A2AResponse>(res.body, this._client.logger);
	}
}
