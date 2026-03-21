/**
 * NNN SDK — Federation Namespace
 *
 * Accessed via `client.federation.*`.
 * Covers federation peers, status, agents, and A2A communication.
 *
 * @module core/namespaces/federation
 */

import type { NnnClientInternals } from '../namespace-helpers';
import type {
	SendA2ARequestParams,
	A2ARequest,
	A2AResponse
} from '../types';
import { NnnError, NnnErrorCode } from '../errors';

/** Generate a unique request ID, safe across all JS runtimes. */
function generateRequestId(): string {
	try {
		if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
			return globalThis.crypto.randomUUID();
		}
	} catch { /* fall back */ }
	return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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
		}

		const rpcRequest: A2ARequest = {
			jsonrpc: '2.0',
			id: generateRequestId(),
			method: params.method,
			params: params.params
		};

		const res = await this._client.fetch(
			targetUrl!,
			{
				method: 'POST',
				headers: this._client.externalHeaders(),
				body: JSON.stringify(rpcRequest)
			},
			'federation.sendA2ARequest',
			true // skipBreaker — external call
		);
		return this._client.safeParseJson<A2AResponse>(res, 'federation.sendA2ARequest', true);
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
		}

		const rpcRequest: A2ARequest = {
			jsonrpc: '2.0',
			id: generateRequestId(),
			method: params.method,
			params: params.params
		};

		const res = await this._client.fetch(
			targetUrl!,
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

		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		try {
			const dataLines: string[] = [];
			let streamDone = false;

			const flushEvent = function* () {
				if (dataLines.length === 0) return;
				const payload = dataLines.splice(0).join('\n');
				if (payload === '[DONE]') { streamDone = true; return; }
				try { yield JSON.parse(payload) as A2AResponse; }
				catch { /* skip unparseable */ }
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
					if (!trimmed) { yield* flushEvent(); if (streamDone) break; continue; }
					if (trimmed.startsWith('data:')) {
						dataLines.push(trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed.slice(5));
					}
				}
			}
			if (!streamDone) yield* flushEvent();
		} finally {
			reader.cancel().catch(() => {});
			reader.releaseLock();
		}
	}
}

