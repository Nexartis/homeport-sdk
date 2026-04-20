# Changelog

All notable changes to the Nexartis NANDA Node SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0](https://github.com/Nexartis/nexartis-nanda-node-sdk/compare/v1.0.0...v1.1.0) (2026-04-20)


### Features

* ABI SDK integration hardening ([d4a4b23](https://github.com/Nexartis/nexartis-nanda-node-sdk/commit/d4a4b23080c3b9334ede5fc4b16d2505c689140d))
* ABI SDK integration hardening ([5bc3a41](https://github.com/Nexartis/nexartis-nanda-node-sdk/commit/5bc3a41e6707335a3235dd3ac0131bbbafbce3cc))
* **docs-site:** add typedoc config and in-repo Cloudflare Worker for sdk.nandanetwork.link ([6871314](https://github.com/Nexartis/nexartis-nanda-node-sdk/commit/687131410fa7dc59fd5e493f1996645260320e90))
* open-source prep — Apache-2.0, trusted-publish, TypeDoc site, workers example (v1.1.0) ([164803e](https://github.com/Nexartis/nexartis-nanda-node-sdk/commit/164803e0d476a19a03b7ffb6bee6b158542b8159))


### Bug Fixes

* **security:** resolve CodeQL ReDoS alerts and drop duplicate codeql workflow ([f2475b7](https://github.com/Nexartis/nexartis-nanda-node-sdk/commit/f2475b7b328d86ae6c7e07fa8add906505dfaa45))

## [1.1.0] - 2026-04-19

### Added
- **Apache-2.0 licensing** — `LICENSE` (Apache 2.0 full text) and `NOTICE` at the
  repo root; `SPDX-License-Identifier: Apache-2.0` headers on every `src/**/*.ts`.
- **Community health files** — `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `SECURITY.md`, `GOVERNANCE.md`, and GitHub issue + pull-request templates.
- **Developer Certificate of Origin** — enforced via a `dco.yml` GitHub Actions
  workflow; all commits require a `Signed-off-by:` trailer.
- **CI and release-please workflows** — `ci.yml` (typecheck + test matrix on
  Node 20 + 22, optional `size-limit` gate) and `release-please.yml`
  (automated conventional-commit release PRs). CodeQL runs via the
  org-level default setup and surfaces alerts on every PR.
- **TypeDoc documentation site** — root `typedoc.json` generates the API
  reference; an in-repo Cloudflare Worker (`typedoc-site/`) serves it at
  `sdk.nandanetwork.link` (prod) and `sdk-dev.nandanetwork.link` (dev).
  `deploy-docs.yml` builds + deploys the site on push to `prod`.
- **`size-limit` bundle-size budgets** — `/core` ≤ 50 KB and root ≤ 80 KB
  (min+gzip), enforced via `pnpm run size` and run in CI.
- **`workers-agent` example** — `examples/workers-agent/` minimal Cloudflare
  Workers consumer demonstrating `NnnClient` on the edge.
- **Public README** — badges, install instructions, features/API matrices,
  compatibility matrix (Node 20+, Bun, Deno, Workers, browsers), contributing
  and governance pointers.

### Changed
- **`publishConfig` → public npmjs with provenance** — switched from GitHub
  Packages (`npm.pkg.github.com`) to `registry.npmjs.org` with
  `"access": "public"` and `"provenance": true`. CI publishes via OIDC trusted
  publishing (no long-lived `NPM_TOKEN`).
- **`license`** — `UNLICENSED` → `Apache-2.0`.
- **`package.json` `files`** — now includes `LICENSE`, `NOTICE`, `README.md`,
  and `CHANGELOG.md` so the published tarball carries the required legal
  artifacts.
- **`package.json` metadata** — polished public-facing `description`; added
  `homepage` (`https://sdk.nandanetwork.link`), `bugs.url`, and `apache-2.0`,
  `oss`, `cloudflare-workers` keywords.
- **`package.json` scripts** — added `docs`, `docs:serve`, `size`, `size:why`,
  and `prepack` (`clean && build`).
- **Examples** — imports switched from `../src/core` to
  `@nexartis/nexartis-nanda-node-sdk`; SPDX headers + extended JSDoc added.

### Migration Notes
- **Consumers of `@nexartis/nexartis-nanda-node-sdk` no longer need a
  `.npmrc`** override for this package. If your `.npmrc` contained a line
  like `@nexartis:registry=https://npm.pkg.github.com` solely for this SDK,
  you can remove it — `pnpm add @nexartis/nexartis-nanda-node-sdk` now
  resolves from the public npmjs registry with no auth. Keep the override
  only if you still consume other `@nexartis/*` packages from GitHub Packages.
- **No runtime API changes.** All namespaces, methods, types, and error codes
  are source-compatible with `1.0.0`.

## [1.0.0] - 2026-03-21

### Added

#### Sprint D — Namespace Refactor & Clean API
- **Namespaced API** — all methods are now accessed through 7 namespace accessors:
  `client.agents`, `client.orchestration`, `client.trust`, `client.federation`,
  `client.webhooks`, `client.developers`, `client.billing`.
- Namespace classes extend `BaseNamespace` and use `NnnClientInternals` bridge for
  shared infrastructure (circuit breaker, caching, request dedup, idempotency).
- Lazy-initialized singleton pattern — namespaces are created on first access.
- Only `health()`, `isHealthy()`, and `deepHealth()` remain as direct methods on `NnnClient`.

#### Sprint C — Missing Endpoint Coverage
- `listWorkflowRuns()`, `listDeveloperKeys()`, `createDeveloperKey()`, `revokeDeveloperKey()`.
- `deprecateAgent()`, `tombstoneAgent()`, `listAgentVersions()`, `createAgentVersion()`.
- `scanCompliance()`, `getTrustGraph()`, `getTrustPath()`, `getBehaviorAnalytics()`.
- `verifyNpPayment()`.

#### Sprint B — Convention Alignment
- Standardized all query params and payloads to `snake_case`.
- `Idempotency-Key` header on all mutating requests.
- In-flight GET request deduplication.
- Opt-in `ResponseCache` with TTL and pattern invalidation.
- Standalone `CircuitBreaker` module.
- Standardized `User-Agent` format with `SDK_VERSION` from `version.ts`.

#### Phase 0 — Immediate Hardening
- Centralized `SDK_VERSION` constant — no more hardcoded version strings.
- `runWorkflow()` method for executing DAG workflows.
- `putJson()` and `deleteJson()` private HTTP helpers.
- `@planned` JSDoc annotations for future-phase types.
- Re-exported `DEFAULT_RETRY_CONFIG` and `SDK_VERSION` from core barrel.

#### Phase 1 — Complete NANDA Protocol Surface
- **A2A JSON-RPC Client** — `sendA2ARequest()` with auto-discovery and optional SSE streaming.
- **Agent Lifecycle** — `updateAgent()`, `deleteAgent()`, `refreshAgent()` CRUD methods.
- **Routing Engine** — `routeRequest()` with skill, trust, and strategy parameters.
- **Workflow Monitoring** — `getWorkflowStatus()`, `cancelWorkflowRun()`, `streamWorkflowEvents()`.
- **Index Sync** — `subscribeToIndex()` (polling) and `diffIndex()` for change detection.

#### Phase 2 — Enterprise Reliability
- **Request/Response Hooks** — `beforeRequest`, `afterResponse`, `onError` lifecycle hooks on `NnnConfig`.
- **OpenTelemetry Tracing** — `traceparent`/`tracestate` header propagation via config and `setTraceContext()`.
- **Circuit Breaker** — Auto-trip after N consecutive failures with configurable cooldown.
- **Structured Error Context** — `NnnError.context` carries `durationMs` on all errors.
- **Deep Health** — `deepHealth()` returns per-subsystem check status and a `degradedChecks` array.

#### Phase 3 — Developer Experience
- **Pagination Iterators** — `searchAgentsAll()` and `listAgentsAll()` `AsyncGenerator` methods for auto-pagination.
- **Code Examples** — `examples/` directory with register-and-discover, orchestrate-workflow, a2a-routing, and health-monitoring examples.
- This changelog.

### Changed
- `NnnConfig` now accepts `hooks`, `circuitBreaker`, and `traceContext` options.
- `NnnError` constructor accepts optional `NnnErrorContext` parameter.
- `NnnError.fromStatus()` and `NnnError.fromNetworkError()` accept optional context.
- `SearchAgentsParams` now includes `limit` and `cursor` for pagination.
