# @nexartis/nexartis-nanda-node-sdk

[![npm version](https://img.shields.io/npm/v/%40nexartis%2Fnexartis-nanda-node-sdk.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/@nexartis/nexartis-nanda-node-sdk)
[![npm downloads](https://img.shields.io/npm/dm/%40nexartis%2Fnexartis-nanda-node-sdk.svg)](https://www.npmjs.com/package/@nexartis/nexartis-nanda-node-sdk)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![CI](https://github.com/Nexartis/nexartis-nanda-node-sdk/actions/workflows/ci.yml/badge.svg?branch=prod)](https://github.com/Nexartis/nexartis-nanda-node-sdk/actions/workflows/ci.yml)
[![Bundle size](https://img.shields.io/bundlephobia/minzip/%40nexartis%2Fnexartis-nanda-node-sdk?label=min%2Bgzip)](https://bundlephobia.com/package/@nexartis/nexartis-nanda-node-sdk)
[![Provenance](https://img.shields.io/badge/provenance-npmjs-success?logo=npm)](https://docs.npmjs.com/generating-provenance-statements)

> The official TypeScript SDK for the **Nexartis NANDA Node** — agent
> registration, A2A discovery, trust scoring, DAG workflow orchestration,
> and NANDA Index resolution.

---

## What is NANDA Node?

[**Project NANDA**](https://projectnanda.org) — *Networked AI Agents in
Decentralized Architecture* — is an open agent discovery protocol that
originated at **MIT Media Lab**. Think of it as *DNS for AI agents*:
a decentralized layer for naming, trust, discovery, and orchestration on the
agentic web.

The **Nexartis NANDA Node (NNN)** is Nexartis' open-source implementation of
the NANDA protocol, running on Cloudflare Workers. A single NNN instance
provides the NANDA Index, `.well-known/agent-card.json` A2A discovery
endpoints, agent certification and reputation scoring, compliance auditing,
webhook delivery, federation (CRDT gossip) with peer nodes, and a DAG
orchestration engine for multi-agent workflows.

This SDK is the official TypeScript client for that API. It is published
under **Apache-2.0**, has **zero runtime dependencies** (uses the platform
`fetch`), runs on Node, Bun, Deno, Cloudflare Workers, and modern browsers,
and exposes a namespaced, fully-typed surface with built-in retry, circuit
breaking, response caching, request deduplication, OpenTelemetry trace
propagation, and typed errors.

## Install

```bash
pnpm add @nexartis/nexartis-nanda-node-sdk
```

<details><summary>npm / yarn / bun / deno</summary>

```bash
npm install @nexartis/nexartis-nanda-node-sdk
yarn  add @nexartis/nexartis-nanda-node-sdk
bun   add @nexartis/nexartis-nanda-node-sdk

# Deno
import { NnnClient } from 'npm:@nexartis/nexartis-nanda-node-sdk';
```

</details>

The package is a public, scoped, provenance-signed publish on
[npmjs.com](https://www.npmjs.com/package/@nexartis/nexartis-nanda-node-sdk).
**No `.npmrc` or auth token is required** to install it.

## 30-second quickstart

```typescript
import { NnnClient } from '@nexartis/nexartis-nanda-node-sdk';

const nnn = new NnnClient({
  baseUrl: 'https://nanda.nexartis.com',
  apiKey: process.env.NNN_API_KEY,
});

// Register an agent
await nnn.agents.register({
  agent_id: 'my-agent',
  agent_url: 'https://my-agent.example.com',
  capabilities: ['text-generation', 'code-review'],
  tags: ['production', 'v2'],
});

// Search for agents
const agents = await nnn.agents.search({
  capabilities: ['text-generation'],
  min_trust: 0.8,
});

// Create and run a DAG workflow
await nnn.orchestration.createWorkflow({
  name: 'review-pipeline',
  owner_id: 'orchestrator-1',
  dag: {
    nodes: [
      { id: 'analyze', type: 'agent', data: { agent_id: 'analyzer' } },
      { id: 'review',  type: 'agent', data: { agent_id: 'reviewer' } },
    ],
    edges: [{ source: 'analyze', target: 'review' }],
  },
});
const result = await nnn.orchestration.runWorkflow('workflow-123', { prompt: 'Analyze this PR' });

// Auto-paginate
for await (const agent of nnn.agents.searchAll({ capabilities: ['code-review'] })) {
  console.log(agent.agent_id);
}

// Health check (never throws)
const healthy = await nnn.isHealthy();
```

## Features

| Capability | Notes |
|---|---|
| **Zero runtime deps** | Uses platform `fetch`. No transitive bloat. |
| **Namespaced API** | 7 logical groupings: `agents`, `orchestration`, `trust`, `federation`, `webhooks`, `developers`, `billing`. |
| **Typed errors** | `NnnError` with `NnnErrorCode` enum — branch on codes, not status numbers. |
| **Retry + backoff** | Exponential backoff with jitter, caller abort-signal forwarding. |
| **Circuit breaker** | Per-endpoint path-grouped breaker; external A2A calls scoped separately. |
| **Response cache** | Opt-in LRU cache for GETs with TTL + pattern invalidation. |
| **Request dedup** | In-flight GET deduplication out of the box. |
| **Idempotency** | `Idempotency-Key` header on every mutating request. |
| **Lifecycle hooks** | `beforeRequest` / `afterResponse` / `onError` for metrics + logging. |
| **OTel trace context** | `traceparent` + `tracestate` propagation via config or `setTraceContext()`. |
| **Auto-pagination** | `searchAll()` / `listAll()` async generators with stale-cursor guards. |
| **SSE streaming** | Server-Sent Events for workflow events + A2A streaming methods. |
| **Provenance-signed** | npm provenance attestations built from a GitHub-hosted workflow. |

## API overview

All methods live on namespaces under the client. The only direct methods on
`NnnClient` are `health()`, `isHealthy()`, and `deepHealth()`.

| Namespace | Purpose |
|---|---|
| `client.agents`        | Register, update, delete, lookup, search, list, version, deprecate, tombstone. Includes `searchAll` / `listAll` async iterators. |
| `client.orchestration` | Create / update / run / cancel DAG workflows; intelligent routing; pattern + delegation + conflict management; index diff + subscribe. |
| `client.trust`         | Lean-Index resolution, trust scores, frameworks, behaviour analytics, compliance scans, trust-graph + path queries. |
| `client.federation`    | Peer discovery, gossip status, federated agent listing, A2A JSON-RPC. |
| `client.webhooks`      | CRUD for subscriptions (create returns a signing `secret`). |
| `client.developers`    | API-key lifecycle + developer earnings. |
| `client.billing`       | Subscriptions, invoices, checkout sessions, NP-payment verification. |

Full generated reference (every type, every method, every example) is hosted
at **<https://nnn-sdk.nexartis.com>**.

## Repository docs

Deeper current-state and audit documentation lives in the repo docs:

- [Product architecture](./docs/PRODUCT_ARCHITECTURE.md)
- [Testing strategy](./docs/TESTING.md)
- [E2E coverage matrix](./docs/E2E_COVERAGE_MATRIX.md)
- [Known issues and audit findings](./docs/ISSUES.md)
- [Roadmap](./docs/ROADMAP.md)
- [Document inventory](./docs/DOCUMENT_INVENTORY.md)

## Examples

Runnable examples live in the [`examples/`](./examples/README.md) directory:

- [`register-and-discover.ts`](./examples/register-and-discover.ts) — registry lifecycle + pagination.
- [`orchestrate-workflow.ts`](./examples/orchestrate-workflow.ts) — DAG create + run + status.
- [`a2a-routing.ts`](./examples/a2a-routing.ts) — A2A JSON-RPC with trace propagation.
- [`health-monitoring.ts`](./examples/health-monitoring.ts) — hooks, circuit breaker, deep health.
- [`workers-agent/`](./examples/workers-agent/README.md) — Cloudflare Workers consumer.

See the [examples README](./examples/README.md) for prerequisites and how to
run each one.

## Compatibility

This SDK targets the platform `fetch` API and has no Node-only dependencies.

| Runtime | Supported | Notes |
|---|---|---|
| **Node.js 20+**         | ✅ | LTS. `fetch` is global as of Node 18 and stable in 20. |
| **Bun**                 | ✅ | `fetch` + Web Streams built in. |
| **Deno**                | ✅ | Install via `npm:@nexartis/nexartis-nanda-node-sdk`. |
| **Cloudflare Workers**  | ✅ | See [`examples/workers-agent`](./examples/workers-agent/README.md). No `nodejs_compat` required for core calls. |
| **Browsers with `fetch`** | ✅ | Any ES2022 target; CORS must be enabled on the NANDA Node. |

ES2022 module output, `"type": "module"`, ships `.d.ts` + sourcemaps.

## Contributing

We welcome contributions from the community. Read
[CONTRIBUTING.md](./CONTRIBUTING.md) for the development workflow, coding
conventions, testing requirements, and review process.

The standard local gate is `pnpm run validate`. The docs site can be deployed
to dev with `pnpm run deploy:dev`; do not run `pnpm run deploy:prod` during
audit work.

All commits must be signed off under the
[Developer Certificate of Origin](https://developercertificate.org/) — run
`git commit -s` to add the required `Signed-off-by:` trailer. A DCO status
check is enforced on every pull request.

Please also review our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Governance

Project direction, maintainer responsibilities, and the decision-making
process are documented in [GOVERNANCE.md](./GOVERNANCE.md).

## Security

To report a vulnerability, please follow the disclosure process in
[SECURITY.md](./SECURITY.md). **Do not** file public GitHub issues for
security reports.

## License

Released under the **Apache License, Version 2.0**. See [LICENSE](./LICENSE)
for the full text and [NOTICE](./NOTICE) for attribution requirements.

```
Copyright (c) 2025-2026 Nexartis, LLC and contributors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0
```
