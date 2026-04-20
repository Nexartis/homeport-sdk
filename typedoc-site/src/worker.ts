/**
 * Cloudflare Worker entrypoint for the Nexartis NANDA Node SDK docs site.
 *
 * Responsibilities:
 *   - Serve the static assets produced by TypeDoc + the branded landing page
 *     (mounted via the ASSETS binding in wrangler.jsonc).
 *   - Rewrite root "/" to the branded landing page.
 *   - Attach security + caching headers to every response.
 *   - Render a branded 404 page when an asset is missing.
 */

export interface Env {
	ASSETS: Fetcher;
	ENVIRONMENT?: string;
	DOCS_CANONICAL_URL?: string;
}

const SECURITY_HEADERS: Record<string, string> = {
	"Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=()",
	"X-Frame-Options": "DENY",
};

function withSecurityHeaders(response: Response): Response {
	const headers = new Headers(response.headers);
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		headers.set(name, value);
	}

	// Cache policy: long-lived for versioned TypeDoc assets (JS/CSS/fonts/images
	// under /api/assets/ are content-hashed by TypeDoc), short for HTML so docs
	// updates are picked up promptly.
	if (!headers.has("Cache-Control")) {
		const contentType = headers.get("Content-Type") ?? "";
		if (contentType.startsWith("text/html")) {
			headers.set("Cache-Control", "public, max-age=300, must-revalidate");
		} else {
			headers.set("Cache-Control", "public, max-age=3600");
		}
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

function renderNotFound(env: Env): Response {
	const canonical = env.DOCS_CANONICAL_URL ?? "https://sdk.nandanetwork.link";
	const body = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>404 · Nexartis NANDA Node SDK docs</title>
<style>
	:root { color-scheme: light dark; }
	body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
		background: #0b0d10; color: #e7eaf0; margin: 0; display: grid;
		place-items: center; min-height: 100vh; padding: 2rem; }
	main { max-width: 34rem; text-align: center; }
	h1 { font-size: 2.5rem; margin: 0 0 0.5rem; letter-spacing: -0.02em; }
	p { line-height: 1.6; color: #a8b0bd; }
	a { color: #8ab4ff; text-decoration: none; }
	a:hover { text-decoration: underline; }
	code { background: #1a1d22; padding: 0.15em 0.4em; border-radius: 4px; }
</style>
</head>
<body>
<main>
	<h1>404 · Not found</h1>
	<p>That page isn't part of the SDK documentation.</p>
	<p>Try the <a href="/api/">API reference</a> or visit <a href="${canonical}/">the docs home</a>.</p>
</main>
</body>
</html>`;

	return new Response(body, {
		status: 404,
		headers: { "Content-Type": "text/html; charset=utf-8" },
	});
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		// Normalise root to the landing page served from /index.html (mounted
		// by the ASSETS binding). Keeping it as a rewrite lets the asset layer
		// handle Last-Modified / ETag negotiation for us.
		if (url.pathname === "/") {
			url.pathname = "/index.html";
			const rewritten = new Request(url.toString(), request);
			const response = await env.ASSETS.fetch(rewritten);
			return withSecurityHeaders(response);
		}

		// Everything else — /api/**, /assets/**, and the landing page resources
		// — is served directly from the assets binding.
		const response = await env.ASSETS.fetch(request);

		if (response.status === 404) {
			return withSecurityHeaders(renderNotFound(env));
		}

		return withSecurityHeaders(response);
	},
} satisfies ExportedHandler<Env>;
