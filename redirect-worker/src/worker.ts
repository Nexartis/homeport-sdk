/**
 * Cloudflare Worker: 301 redirects from the legacy Homeport SDK docs
 * hostnames (nnn-sdk[-dev].nexartis.com) to the current origins
 * (homeport-sdk[-dev].nexartis.com), preserving path + query.
 *
 * The `TARGET` origin is injected per-environment from wrangler.jsonc
 * `vars.TARGET`. Redirects are cacheable for one hour with
 * revalidation, so browser + intermediary caches pick up cut-over
 * quickly if we ever need to point the legacy hosts elsewhere.
 */

export interface Env {
	TARGET: string;
	ENVIRONMENT?: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const target = env.TARGET.replace(/\/+$/, "");
		const location = `${target}${url.pathname}${url.search}`;
		return new Response(null, {
			status: 301,
			headers: {
				Location: location,
				"Cache-Control": "public, max-age=3600, must-revalidate",
				"Referrer-Policy": "strict-origin-when-cross-origin",
				"X-Content-Type-Options": "nosniff",
			},
		});
	},
} satisfies ExportedHandler<Env>;
