import { defineConfig } from "vitest/config";

/**
 * Vitest config for the Homeport SDK docs site.
 *
 * Currently exercises the sibling redirect-worker/src/worker.ts fetch
 * handler in-process (fast, hermetic, no wrangler startup). The
 * Playwright landing suite has its own config in `playwright.config.ts`.
 */
export default defineConfig({
	test: {
		include: ["tests/**/*.spec.ts"],
		exclude: ["tests/**/*.e2e.spec.ts", "node_modules/**"],
		environment: "node",
		globals: false,
	},
});
