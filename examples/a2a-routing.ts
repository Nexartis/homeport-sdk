// SPDX-License-Identifier: Apache-2.0
/**
 * Example — Agent-to-Agent (A2A) JSON-RPC routing with trace propagation.
 *
 * Demonstrates:
 *   1. `client.orchestration.routeRequest` — best-match agent resolution by skill + trust.
 *   2. `client.federation.sendA2ARequest`  — JSON-RPC over A2A with auto-discovery.
 *   3. `traceContext` constructor option   — W3C traceparent propagation on every call.
 *
 * Run:
 *   HOMEPORT_API_KEY=... npx tsx examples/a2a-routing.ts
 *
 * Requires Node 20+, Bun, or Deno with `fetch`.
 */

import { HomeportClient } from '@nexartis/homeport-sdk';

const client = new HomeportClient({
	baseUrl: 'https://homeport.example.com',
	apiKey: process.env.HOMEPORT_API_KEY,
	verbose: true,
	// OpenTelemetry trace propagation
	traceContext: {
		traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
	}
});

async function main() {
	// 1. Route a request to the best-matching agent
	const route = await client.orchestration.routeRequest({
		skill: 'code-review',
		min_trust: 0.85,
		strategy: 'best-match'
	});
	console.log('🎯 Routed to:', route.targetAgent.agent_id);
	console.log('   Score:', route.score);
	console.log('   Protocol:', route.protocol);

	// 2. Send an A2A JSON-RPC request (auto-discovers agent URL)
	const response = await client.federation.sendA2ARequest({
		target_agent_id: route.targetAgent.agent_id,
		method: 'tasks/send',
		params: {
			message: {
				role: 'user',
				parts: [{ type: 'text', text: 'Review this pull request for security issues' }]
			}
		}
	});
	console.log('📨 A2A Response:', JSON.stringify(response.result, null, 2));

	// 3. Send A2A request directly to a known URL (skips discovery)
	const directResponse = await client.federation.sendA2ARequest({
		target_agent_id: 'known-agent',
		target_url: 'https://agent.example.com/a2a',
		method: 'tasks/get',
		params: { id: 'task-123' }
	});
	console.log('📬 Direct response:', directResponse.result);
}

main().catch(console.error);

