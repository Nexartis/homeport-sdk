# Changelog

All notable changes to the Nexartis NANDA Node SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

