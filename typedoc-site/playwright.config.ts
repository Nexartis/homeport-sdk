import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config for the Homeport SDK docs site.
 *
 * Runs against a locally-staged `./dist/` served by a static HTTP
 * server on port 4319 (chosen to avoid the workspace-common
 * 5173/5174/8080/8090 ports). CI can override via `BASE_URL`.
 *
 * NOTE: the redirect-worker fetch handler is unit-tested in
 * `tests/redirect-worker.spec.ts` via vitest — that file is excluded
 * from the playwright glob below.
 */
const PORT = Number(process.env.HOMEPORT_DOCS_PORT ?? 4319);
const BASE_URL = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
	testDir: "./tests",
	testMatch: /.*\.e2e\.spec\.ts$/,
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: 0,
	reporter: [["list"]],
	use: {
		baseURL: BASE_URL,
		trace: "off",
	},
	projects: [
		{ name: "chromium", use: { ...devices["Desktop Chrome"] } },
	],
	webServer: process.env.BASE_URL
		? undefined
		: {
				command: `npx --yes http-server ./dist -p ${PORT} -c-1 --silent`,
				url: BASE_URL,
				reuseExistingServer: !process.env.CI,
				timeout: 30_000,
			},
});
