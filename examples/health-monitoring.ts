// SPDX-License-Identifier: Apache-2.0
/**
 * Example — Health monitoring with lifecycle hooks, circuit breaker, and deep health.
 *
 * Demonstrates:
 *   1. `hooks.beforeRequest` / `afterResponse` / `onError` — per-call observability.
 *   2. `circuitBreaker` config — auto-trip after N failures with cooldown.
 *   3. `client.isHealthy` / `client.deepHealth` — liveness + per-subsystem checks.
 *   4. `client.orchestration.diffIndex` / `subscribeToIndex` — index change feed.
 *
 * Run:
 *   NNN_API_KEY=... npx tsx examples/health-monitoring.ts
 *
 * Requires Node 20+, Bun, or Deno with `fetch`.
 */

import { NnnClient } from '@nexartis/nexartis-nanda-node-sdk';

const client = new NnnClient({
	baseUrl: 'https://nanda.nexartis.com',
	apiKey: process.env.NNN_API_KEY,
	verbose: true,

	// Lifecycle hooks for observability
	hooks: {
		beforeRequest: (url, init) => {
			console.log(`➡️  ${init.method ?? 'GET'} ${url}`);
		},
		afterResponse: (url, _response, durationMs) => {
			console.log(`✅ ${url} — ${durationMs}ms`);
		},
		onError: (url, error) => {
			console.error(`❌ ${url} failed:`, error);
		}
	},

	// Circuit breaker: trip after 3 failures, cooldown 15s
	circuitBreaker: {
		failureThreshold: 3,
		cooldownMs: 15_000
	}
});

async function main() {
	// 1. Basic health check
	const healthy = await client.isHealthy();
	console.log('🏥 Healthy:', healthy);

	// 2. Deep health check with subsystem details
	const deep = await client.deepHealth();
	console.log('\n🔬 Deep health:');
	console.log('   Overall:', deep.healthy ? '✅ healthy' : '⚠️  degraded');
	console.log('   Status:', deep.status);
	console.log('   Environment:', deep.environment);
	console.log('   Agents:', deep.agents);
	console.log('   Checks:', deep.checks);

	if (deep.degradedChecks.length > 0) {
		console.log('   ⚠️  Degraded:', deep.degradedChecks.join(', '));
	}

	// 3. Monitor index changes
	const diff = await client.orchestration.diffIndex(new Date(Date.now() - 24 * 60 * 60 * 1000));
	console.log('\n📈 Index changes (last 24h):');
	console.log('   Added:', diff.added.length);
	console.log('   Removed:', diff.removed.length);
	console.log('   Updated:', diff.updated.length);

	// 4. Subscribe to real-time index changes
	const unsubscribe = client.orchestration.subscribeToIndex((event) => {
		console.log('🔔 Index change:', event.type, event.agentId);
	}, 30_000);

	// Stop after 5 minutes
	setTimeout(() => {
		unsubscribe();
		console.log('🛑 Unsubscribed from index changes');
	}, 5 * 60 * 1000);
}

main().catch(console.error);

