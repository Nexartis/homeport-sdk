// SPDX-License-Identifier: Apache-2.0
/**
 * Example — Cloudflare Workers consumer of @nexartis/nexartis-nanda-node-sdk.
 *
 * Exposes a single route, `GET /health`, that uses NnnClient to call the
 * NANDA Node health endpoint from the edge and returns the result as JSON.
 *
 * Run locally: `pnpm run dev`, then `curl http://localhost:8787/health`.
 */

import { NnnClient, NnnError } from '@nexartis/nexartis-nanda-node-sdk';

interface Env {
	NNN_BASE_URL: string;
	/** Provide via `wrangler secret put NNN_API_KEY`. */
	NNN_API_KEY?: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (request.method !== 'GET' || url.pathname !== '/health') {
			return new Response('Not Found', { status: 404 });
		}

		const client = new NnnClient({
			baseUrl: env.NNN_BASE_URL,
			apiKey: env.NNN_API_KEY,
		});

		try {
			const health = await client.deepHealth();
			return Response.json(health, {
				status: health.healthy ? 200 : 503,
				headers: { 'Cache-Control': 'no-store' },
			});
		} catch (err) {
			const code = err instanceof NnnError ? err.code : 'UNKNOWN';
			const message = err instanceof Error ? err.message : String(err);
			return Response.json({ error: code, message }, { status: 502 });
		}
	},
} satisfies ExportedHandler<Env>;
