# Homeport SDK Testing Strategy

## Executive summary

The SDK uses Vitest for unit tests, TypeScript for type safety, TypeDoc generation for documentation integrity, and Size Limit for bundle-size guardrails. The docs site is deployable, so public browser smoke coverage is tracked as a current gap until Playwright tests are added.

## Validation command matrix

| Command | Purpose | Expected use |
|---|---|---|
| `pnpm install --frozen-lockfile` | Install exact root dependencies. | CI and clean local setup. |
| `pnpm run typecheck` | TypeScript check without emitting files. | Manual diagnostic; the emitting build performs the identical check inside `validate`. |
| `pnpm run check` | Standard alias for `typecheck`. | Cross-repo convention. |
| `pnpm run test` | Run Vitest unit tests once. | Local and CI quality gate. |
| `pnpm run build` | Emit ESM JavaScript, declarations, and sourcemaps into `dist/`. | Before packaging, docs, and deploys. |
| `pnpm run docs` | Generate TypeDoc output into `typedoc-site/dist/api`. | Before docs-site deploys. |
| `pnpm run docs:stage` | Generate TypeDoc and copy the landing page assets into `typedoc-site/dist/`. | Before docs-site deploys. |
| `pnpm run size` | Check configured min+gzip size budgets. | CI and release readiness. |
| `pnpm run validate` | Safe local audit gate: tests, build, docs, and size (the emitting build performs the type check). | Before PR, push, and dev deploy. |
| `pnpm run deploy:dev` | Build, stage, and deploy the docs site to dev. | Audit/dev validation only. |
| `pnpm run deploy:prod` | Build, stage, and deploy the docs site to prod. | Release-owner/final-audit path only after validation passes. |

## Unit and integration approach

- `src/**/*.test.ts` covers the SDK client, namespaces, errors, logger, retry behavior, caching, deduplication, idempotency, trace propagation, and typed error paths.
- Tests mock `globalThis.fetch`; they do not require a live NANDA Node or API key.
- Runtime API behavior should stay covered when changing `src/core/**`.
- Example Worker integration is not currently automated and is tracked in `ISSUES.md`.

## End-to-end and browser approach

The root SDK package is not a browser app. However, `typedoc-site/` serves a public docs landing page and generated API reference, so public Playwright smoke coverage is applicable for the docs site and tracked in `E2E_COVERAGE_MATRIX.md`.

Authenticated Playwright testing is not applicable because the SDK docs site has no login journey.

## Coverage expectations

- Runtime changes require unit tests.
- Public API changes require README/TypeDoc updates and may require contract tests when a stable server contract fixture exists.
- Docs-site UI changes should eventually include Playwright coverage for navigation, install tabs, copy behavior, and API-reference availability.
- Accessibility smoke coverage should verify headings, navigation, controls, labels, keyboard paths, and focus states for the landing page.

## Known testing gaps

See `ISSUES.md` for the active gap register. Current gaps include docs-site Playwright coverage, accessibility smoke coverage, example Worker integration tests, and published API contract tests.
