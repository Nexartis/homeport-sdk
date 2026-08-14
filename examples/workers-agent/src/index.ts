// SPDX-License-Identifier: Apache-2.0
/**
 * Example — Cloudflare Workers consumer of @nexartis/homeport-sdk.
 *
 * Exposes a single route, `GET /health`, that uses HomeportClient to call the
 * Homeport health endpoint from the edge and returns the result as JSON.
 *
 * Run locally: `pnpm run dev`, then `curl http://localhost:8787/health`.
 */

import { HomeportClient, HomeportError } from '@nexartis/homeport-sdk';

interface Env {
	HOMEPORT_BASE_URL: string;
	/** Provide via `wrangler secret put HOMEPORT_API_KEY`. */
	HOMEPORT_API_KEY?: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (request.method !== 'GET' || url.pathname !== '/health') {
			return new Response('Not Found', { status: 404 });
		}

		const client = new HomeportClient({
			baseUrl: env.HOMEPORT_BASE_URL,
			apiKey: env.HOMEPORT_API_KEY,
		});

		try {
			const health = await client.deepHealth();
			return Response.json(health, {
				status: health.healthy ? 200 : 503,
				headers: { 'Cache-Control': 'no-store' },
			});
		} catch (err) {
			const code = err instanceof HomeportError ? err.code : 'UNKNOWN';
			const message = err instanceof Error ? err.message : String(err);
			return Response.json({ error: code, message }, { status: 502 });
		}
	},
} satisfies ExportedHandler<Env>;
