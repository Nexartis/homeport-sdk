import { describe, expect, it } from "vitest";
import worker from "../../redirect-worker/src/worker";

/**
 * Vitest unit coverage for the Homeport SDK legacy-redirect Worker.
 *
 * We invoke the fetch handler directly rather than booting `wrangler
 * dev` — this keeps the suite fast, hermetic, and free of the
 * miniflare/wrangler startup cost. Live 301 verification against
 * nnn-sdk[-dev].nexartis.com is a POST-DEPLOY step (see this file's
 * README block in ../README.md and redirect-worker/README.md).
 */

const DEV_ENV = { TARGET: "https://homeport-sdk-dev.nexartis.com", ENVIRONMENT: "development" } as const;
const PROD_ENV = { TARGET: "https://homeport-sdk.nexartis.com", ENVIRONMENT: "production" } as const;

async function callWorker(url: string, env: { TARGET: string }): Promise<Response> {
	const req = new Request(url, { method: "GET" });
	// The worker's Env includes only TARGET + ENVIRONMENT — the extra positional
	// args (ctx, waitUntil, passThroughOnException) are not exercised.
	// biome-ignore lint/suspicious/noExplicitAny: minimal shim
	return worker.fetch(req, env as any, {} as any);
}

describe("legacy-redirect worker", () => {
	it("301s root path to the dev target", async () => {
		const res = await callWorker("https://nnn-sdk-dev.nexartis.com/", DEV_ENV);
		expect(res.status).toBe(301);
		expect(res.headers.get("Location")).toBe("https://homeport-sdk-dev.nexartis.com/");
	});

	it("301s root path to the prod target", async () => {
		const res = await callWorker("https://nnn-sdk.nexartis.com/", PROD_ENV);
		expect(res.status).toBe(301);
		expect(res.headers.get("Location")).toBe("https://homeport-sdk.nexartis.com/");
	});

	it("preserves pathname (deep-linked TypeDoc pages)", async () => {
		const res = await callWorker(
			"https://nnn-sdk.nexartis.com/api/classes/HomeportClient.html",
			PROD_ENV,
		);
		expect(res.headers.get("Location")).toBe(
			"https://homeport-sdk.nexartis.com/api/classes/HomeportClient.html",
		);
	});

	it("preserves query string", async () => {
		const res = await callWorker(
			"https://nnn-sdk-dev.nexartis.com/api/?q=agent&page=2",
			DEV_ENV,
		);
		expect(res.headers.get("Location")).toBe(
			"https://homeport-sdk-dev.nexartis.com/api/?q=agent&page=2",
		);
	});

	it("emits the cache-control policy from the spec", async () => {
		const res = await callWorker("https://nnn-sdk.nexartis.com/", PROD_ENV);
		expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600, must-revalidate");
	});

	it("tolerates a trailing slash on TARGET without doubling the separator", async () => {
		const res = await callWorker("https://nnn-sdk.nexartis.com/api/", {
			TARGET: "https://homeport-sdk.nexartis.com/",
		});
		expect(res.headers.get("Location")).toBe("https://homeport-sdk.nexartis.com/api/");
	});
});
