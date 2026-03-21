# Nexartis NANDA Node SDK — Enterprise Production Roadmap

> **Owner:** Nexartis · **SDK:** `@nexartis/nexartis-nanda-node-sdk`
> **Last updated:** 2026-03-21

---

## Phase 0 — Immediate Hardening (Sprint 1)

_Priority: ship with current `feat/cleanup-and-docs` PR_

| # | Item | Severity | Effort |
|---|------|----------|--------|
| 0.1 | **Centralize `SDK_VERSION` constant** — Replace hardcoded `'NNN-SDK/1.0'` in `client.ts:54` with a single `SDK_VERSION` constant that reflects the actual package version. | 🟡 Debt | 10 min |
| 0.2 | **Add orchestration test coverage** — `createWorkflow()` and `listWorkflows()` are fully implemented but have zero tests. Add tests following existing patterns. | 🟡 Gap | 20 min |
| 0.3 | **Implement `runWorkflow()` method** — Type `WorkflowRunResult` already exists. Add `POST /api/orchestration/{id}/run` client method to complete the orchestration lifecycle. | 🟡 Feature gap | 30 min |
| 0.4 | **Add `putJson`/`deleteJson` helpers** — Only GET and POST are currently supported. Required for full CRUD agent management. | 🟢 Foundation | 15 min |
| 0.5 | **Annotate orphaned types** — Add `/** @planned */` JSDoc to `RoutingRequest`, `RoutingResult`, `A2ARequest`, `A2AResponse` or remove if not on roadmap. | 🟢 Clarity | 10 min |
| 0.6 | **Re-export `DEFAULT_RETRY_CONFIG`** from `index.ts` — Let consumers inspect/spread default retry configuration. | 🟢 DX | 2 min |

---

## Phase 1 — Complete the NANDA Protocol Surface (Sprint 2)

### 1.1 A2A JSON-RPC Client

Implement the Agent-to-Agent JSON-RPC protocol methods:

```ts
const result = await client.sendA2ARequest({
  target_agent_id: 'agent-xyz',
  method: 'tasks/send',
  params: { message: { role: 'user', parts: [{ type: 'text', text: 'Hello' }] } }
});
```

- Use existing `A2ARequest` / `A2AResponse` types.
- Auto-discover agent URL via `lookupAgent()` if not provided.
- Support streaming via `tasks/sendSubscribe` with SSE parsing.

### 1.2 Agent Lifecycle Management

Complete CRUD for agent registration:
- `updateAgent(agentId, updates)` — `PUT /api/agents/{id}`
- `deleteAgent(agentId)` — `DELETE /api/agents/{id}`
- `refreshAgent(agentId)` — `POST /api/agents/{id}/refresh` (re-crawl agent card)

### 1.3 Routing Engine Client

Implement smart agent routing using existing types:

```ts
const route = await client.routeRequest({
  skill: 'code-review',
  min_trust: 0.8,
  strategy: 'best-match' // or 'round-robin', 'least-latency'
});
```

### 1.4 Workflow Execution & Monitoring

Extend orchestration beyond create/list/run:
- `getWorkflowStatus(workflowId, runId)` — poll execution status.
- `cancelWorkflowRun(workflowId, runId)` — abort in-progress run.
- `streamWorkflowEvents(workflowId, runId)` — SSE-based real-time updates.

### 1.5 NANDA Index Sync

- `subscribeToIndex(callback)` — Webhook or polling-based index change notifications.
- `diffIndex(since: Date)` — Get agents added/removed/updated since a timestamp.

---

## Phase 2 — Enterprise Reliability (Sprint 3)

### 2.1 Request / Response Lifecycle Hooks

```ts
const client = new NnnClient({
  baseUrl: '...',
  hooks: {
    beforeRequest: (url, init) => { /* inject tracing headers */ },
    afterResponse: (url, response, durationMs) => { /* emit metrics */ },
    onError: (url, error) => { /* alert on failure */ },
  }
});
```

### 2.2 OpenTelemetry-Compatible Tracing

- Propagate `traceparent` / `tracestate` headers through all requests.
- Emit span-compatible timing data via hooks.
- Zero added dependencies — work through the hooks interface.

### 2.3 Circuit Breaker Pattern

Auto-trip after N consecutive failures. Fast-fail during cooldown. Critical for orchestration scenarios where one down agent shouldn't block the entire DAG.

### 2.4 Structured Error Context

Enrich `NnnError` with:
- `requestId` from response headers.
- `retryCount` — attempts made before failure.
- `durationMs` — total wall-clock time.
- `agentId` — which agent the request was targeting (for A2A calls).

### 2.5 Health Check Aggregation

```ts
const status = await client.deepHealth(); // checks DB, KV, R2, queues
if (status.checks.queues === 'degraded') {
  // fall back to synchronous processing
}
```

---

## Phase 3 — Developer Experience (Sprint 4)

### 3.1 TypeDoc API Documentation

- Generate API reference from JSDoc on every release.
- Publish to GitHub Pages.
- Include architecture diagrams (DAG orchestration flow, A2A routing).

### 3.2 Code Examples

Create `examples/` directory:
- `examples/register-and-discover.ts`
- `examples/orchestrate-workflow.ts`
- `examples/a2a-routing.ts`
- `examples/health-monitoring.ts`

### 3.3 Changelog & Semantic Versioning

- `CHANGELOG.md` following Keep a Changelog format.
- `changeset` integration for automated version management.
- Conventional commits enforcement in CI.

### 3.4 Pagination Iterators

```ts
for await (const agent of client.searchAgentsAll({ q: 'code-review' })) {
  console.log(agent.agent_id);
}
```

Auto-paginate through large result sets with `AsyncGenerator`.

---

## Phase 4 — Security & Compliance (Sprint 5)

### 4.1 API Key Rotation Support

- Accept an array of API keys with `validFrom` / `validUntil` windows.
- Auto-select the active key. Emit warning when approaching expiry.

### 4.2 mTLS / Client Certificate Support

For enterprise deployments requiring mutual TLS:
```ts
const client = new NnnClient({
  baseUrl: '...',
  tls: { cert: fs.readFileSync('client.pem'), key: fs.readFileSync('client-key.pem') }
});
```

### 4.3 Secret Redaction in Logs

Ensure API keys are never logged at any level. Auto-redact strings matching `Bearer .*` or known key patterns in logger output.

### 4.4 Dependency Audit CI Step

- `pnpm audit` in CI pipeline.
- Fail on critical/high vulnerabilities.
- Maintain zero runtime dependencies policy.

### 4.5 SBOM Generation

Generate CycloneDX or SPDX Software Bill of Materials on every release for enterprise procurement.

---

## Phase 5 — Performance & Scale (Sprint 6)

### 5.1 Connection Pooling / Keep-Alive

Ensure HTTP/2 multiplexing and keep-alive. Document runtime-specific fetch behavior (Node.js `undici` vs. Cloudflare Workers).

### 5.2 Response Caching

Optional in-memory LRU cache for read-heavy endpoints:
- `lookupAgent`, `getAgentFacts`, `getNandaIndex` — configurable TTL.
- Bypass with `{ cache: false }`.

### 5.3 Request Deduplication

If the same GET request is in-flight, return the existing promise instead of firing a duplicate. Prevents thundering herd in concurrent discovery scenarios.

### 5.4 Batch Agent Operations

```ts
const agents = await client.lookupAgentsBatch(['agent-1', 'agent-2', 'agent-3']);
```

Reduce round-trips when resolving multiple agents for DAG orchestration.

---

## Phase 6 — CI/CD & Release Engineering (Sprint 7)

### 6.1 GitHub Actions CI Pipeline

- **On PR:** lint → typecheck → test → build → size check.
- **On merge to `dev`:** publish `@next` prerelease to GitHub Packages.
- **On merge to `prod`:** publish stable release, generate changelog, create GitHub Release.

### 6.2 Bundle Size Tracking

- `size-limit` in CI, fail on >5% increase.
- Target: <10 KB minified+gzipped.

### 6.3 Test Coverage Thresholds

- ≥90% line coverage, ≥85% branch coverage via `vitest --coverage`.
- Fail CI on coverage regression.

### 6.4 Integration Test Suite

- Mock NANDA node server (MSW or lightweight stub).
- Test full agent registration → discovery → A2A routing flow.
- Test DAG orchestration with multi-step workflows.
- Simulate transient failures and verify retry/circuit-breaker behavior.

### 6.5 Multi-Runtime Testing

- Node.js (current LTS + latest).
- Cloudflare Workers (miniflare).
- Bun.
- Verify `navigator.userAgent === 'Cloudflare-Workers'` detection before `process.versions.node`.

---

## Backlog — Future Considerations

| Item | Notes |
|------|-------|
| **GraphQL discovery layer** | If NANDA adds GraphQL for complex agent queries |
| **gRPC transport** | For high-throughput A2A communication |
| **WebSocket A2A channel** | Persistent bi-directional agent communication |
| **React hooks** | `useAgent()`, `useWorkflowStatus()` for dashboards |
| **CLI tool** | `npx nnn search "code-review"`, `npx nnn health` |
| **Agent card validator** | Validate A2A Agent Cards against the spec before registration |
| **SDK telemetry opt-in** | Anonymous usage metrics for SDK improvement |

