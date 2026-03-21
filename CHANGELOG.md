# Changelog

All notable changes to the Nexartis NANDA Node SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-21

### Added

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

