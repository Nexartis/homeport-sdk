<p align="center">
  <a href="https://github.com/Nexartis/homeport"><img src="https://raw.githubusercontent.com/Nexartis/homeport-sdk/dev/.github/homeport-header.webp" alt="Homeport — the open-source, self-hostable NANDA node" width="800" /></a>
</p>

# Homeport SDK

[![npm version](https://img.shields.io/npm/v/%40nexartis%2Fhomeport-sdk.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/@nexartis/homeport-sdk)
[![npm downloads](https://img.shields.io/npm/dm/%40nexartis%2Fhomeport-sdk.svg)](https://www.npmjs.com/package/@nexartis/homeport-sdk)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![CI](https://github.com/Nexartis/homeport-sdk/actions/workflows/ci.yml/badge.svg?branch=prod)](https://github.com/Nexartis/homeport-sdk/actions/workflows/ci.yml)
[![Bundle size](https://img.shields.io/bundlephobia/minzip/%40nexartis%2Fhomeport-sdk?label=min%2Bgzip)](https://bundlephobia.com/package/@nexartis/homeport-sdk)
[![Provenance](https://img.shields.io/badge/provenance-npmjs-success?logo=npm)](https://docs.npmjs.com/generating-provenance-statements)

> **Official TypeScript SDK for [Homeport](https://github.com/Nexartis/homeport)** — the open-source, self-hostable NANDA node from Nexartis. Register agents, discover peers, score trust, orchestrate DAG workflows, and resolve the NANDA Index from any modern JavaScript runtime.

---

## What is Homeport?

[**Project NANDA**](https://projectnanda.org) — *Networked AI Agents in Decentralized Architecture* — is an open agent discovery protocol that originated at **MIT Media Lab**. Think of it as *DNS for AI agents*: a decentralized layer for naming, trust, discovery, and orchestration on the agentic web.

**Homeport** is Nexartis' open-source, self-hostable implementation of the NANDA protocol, running on Cloudflare Workers. A single Homeport instance provides the NANDA Index, `.well-known/agent-card.json` A2A discovery endpoints, agent certification and reputation scoring, compliance auditing, webhook delivery, federation (CRDT gossip) with peer nodes, and a DAG orchestration engine for multi-agent workflows.

This SDK is the official TypeScript client for that API. It is published under **Apache-2.0**, has **zero runtime dependencies** (uses the platform `fetch`; `composeHomeportA2AFields` is structural and does not import GitHub Packages), runs on Node, Bun, Deno, Cloudflare Workers, and modern browsers, and exposes a namespaced, fully-typed surface with built-in retry, circuit breaking, response caching, request deduplication, OpenTelemetry trace propagation, and typed errors. Protocol packages: `nexartis-wire-contracts/docs/DEVELOPER.md`.

## Install

```bash
pnpm add @nexartis/homeport-sdk
```

<details><summary>npm / yarn / bun / deno</summary>

```bash
npm install @nexartis/homeport-sdk
yarn  add @nexartis/homeport-sdk
bun   add @nexartis/homeport-sdk

# Deno
import { HomeportClient } from 'npm:@nexartis/homeport-sdk';
```

</details>

The package is a public, scoped, provenance-signed publish on [npmjs.com](https://www.npmjs.com/package/@nexartis/homeport-sdk). **No `.npmrc` or auth token is required** to install it.

## 30-second quickstart

```typescript
import { HomeportClient } from '@nexartis/homeport-sdk';

const homeport = new HomeportClient({
  baseUrl: 'https://homeport.example.com',
  apiKey: process.env.HOMEPORT_API_KEY,
});

// Register an agent
await homeport.agents.register({
  agent_id: 'my-agent',
  agent_url: 'https://my-agent.example.com',
  capabilities: ['text-generation', 'code-review'],
  tags: ['production', 'v2'],
});

// Search for agents
const agents = await homeport.agents.search({
  capabilities: ['text-generation'],
  min_trust: 0.8,
});

// Create and run a DAG workflow
await homeport.orchestration.createWorkflow({
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
const result = await homeport.orchestration.runWorkflow('workflow-123', { prompt: 'Analyze this PR' });

// Scoped delegation grants — issued via the A2A JSON-RPC envelope.
const grant = await homeport.orchestration.grantDelegation({
  granted_by_did: 'did:web:example-operator',
  granted_to_did: 'did:web:example-delegate',
  granted_scope: ['payments:send'],
  expires_at: Math.floor(Date.now() / 1000) + 300,
  granted_by_proof_hash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  proof: {
    principalPk: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    deviceDid: 'did:key:example-device',
    requestId: 'preapproval-1',
    boundAt: Date.now() - 1000,
    issuedAt: Date.now(),
    signature: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=='
  }
});
const status = await homeport.orchestration.checkDelegation(grant.delegationId);
await homeport.orchestration.revokeDelegation({ delegation_id: grant.delegationId });

// Auto-paginate
for await (const agent of homeport.agents.searchAll({ capabilities: ['code-review'] })) {
  console.log(agent.agent_id);
}

// Health check (never throws)
const healthy = await homeport.isHealthy();
```

## Features

| Capability | Notes |
|---|---|
| **Zero runtime deps** | Uses platform `fetch`. No transitive bloat. |
| **Namespaced API** | 7 logical groupings: `agents`, `orchestration`, `trust`, `federation`, `webhooks`, `developers`, `billing`. |
| **Typed errors** | `HomeportError` with `HomeportErrorCode` enum — branch on codes, not status numbers. |
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

All methods live on namespaces under the client. The only direct methods on `HomeportClient` are `health()`, `isHealthy()`, and `deepHealth()`.

| Namespace | Purpose |
|---|---|
| `client.agents`        | Register, update, delete, lookup, search, list, version, deprecate, tombstone. Includes `searchAll` / `listAll` async iterators. |
| `client.orchestration` | Create / update / run / cancel DAG workflows; intelligent routing; pattern + delegation + conflict management; index diff + subscribe. Includes scoped delegation grants — `grantDelegation`, `revokeDelegation`, `checkDelegation` — dispatched over the A2A JSON-RPC envelope with PUH proofs and cascading revocation. |
| `client.trust`         | Lean-Index resolution, trust scores, frameworks, behaviour analytics, compliance scans, trust-graph + path queries, `getBadges`. |
| `client.federation`    | Peer discovery, gossip status, federated agent listing, A2A JSON-RPC. |
| `client.webhooks`      | CRUD for subscriptions (create returns a signing `secret`). |
| `client.developers`    | API-key lifecycle + developer earnings. |
| `client.billing`       | Subscriptions, invoices, checkout sessions, NP-payment verification. |

Full generated reference (every type, every method, every example) is hosted at **<https://homeport-sdk.nexartis.com>**.

## Migrating from `@nexartis/nexartis-nanda-node-sdk`

Current release is `@nexartis/homeport-sdk@1.1.0`. It supersedes `@nexartis/nexartis-nanda-node-sdk` (last published as 1.2.1). The wire protocol is unchanged — names and env vars moved at 1.0.0; 1.1.0 adds visibility / capability / MCP / pricing / trust-badge contracts.

```bash
pnpm remove @nexartis/nexartis-nanda-node-sdk
pnpm add @nexartis/homeport-sdk
```

| Old symbol / env | New symbol / env |
|---|---|
| `import { NnnClient } from '@nexartis/nexartis-nanda-node-sdk'` | `import { HomeportClient } from '@nexartis/homeport-sdk'` |
| `NnnError`, `NnnErrorCode`, `NnnErrorContext` | `HomeportError`, `HomeportErrorCode`, `HomeportErrorContext` |
| `createNnnLogger`, `NnnLogger` | `createHomeportLogger`, `HomeportLogger` |
| `NNN_API_KEY` (env) | `HOMEPORT_API_KEY` (env) |
| Log prefix `[nnn-sdk]` | Log prefix `[homeport-sdk]` |
| Docs `nnn-sdk.nexartis.com` | Docs `homeport-sdk.nexartis.com` (legacy hostnames 301 for a deprecation window) |

The legacy package is `npm deprecate`d with a pointer to this one. See [`CHANGELOG.pre-homeport.md`](./CHANGELOG.pre-homeport.md) for the pre-rebrand release history and [`docs/REBRAND-RUNBOOK.md`](./docs/REBRAND-RUNBOOK.md) for the operator-side migration checklist.

## Breaking change: delegation grants require a `proof` envelope

`DelegationGrantRequest.proof` (`src/core/types.ts`, WC-P0-04) is **required** as of this release train. The Homeport server verifies `proof.signature` and re-derives `granted_by_proof_hash` from the canonical proof envelope before any grant write; the SDK validates presence and shape client-side and fails closed before the POST.

**Consumer impact:** every call to `delegation.grant` (and `grantDelegation`) that omits `proof` now throws client-side. Previously-working callers must attach the PUH proof envelope produced by the WebAuthn ceremony that authorized the grant (`granted_by_proof_hash` alone is no longer sufficient). Callers do not construct envelopes by hand — obtain them from the PUH preapproval flow (see the `proof` field in the [quickstart delegation example](#30-second-quickstart), which shows a preapproval-signed envelope).

**Versioning disclosure:** this widens a public request type within a `1.x` release rather than a dedicated major. Consumers who need the old lenient shape should pin their current version; the next major will keep `proof` required. Tracked in promote review threads on `Nexartis/homeport-sdk#61`.

## Repository docs

Deeper current-state and audit documentation lives in the repo docs:

- [Product architecture](./docs/PRODUCT_ARCHITECTURE.md)
- [Testing strategy](./docs/TESTING.md)
- [E2E coverage matrix](./docs/E2E_COVERAGE_MATRIX.md)
- [Known issues and audit findings](./docs/ISSUES.md)
- [Roadmap](./docs/ROADMAP.md)
- [Rebrand runbook](./docs/REBRAND-RUNBOOK.md)
- [Document inventory](./docs/DOCUMENT_INVENTORY.md)

## Examples

Runnable examples live in the [`examples/`](./examples/README.md) directory:

- [`register-and-discover.ts`](./examples/register-and-discover.ts) — registry lifecycle + pagination.
- [`orchestrate-workflow.ts`](./examples/orchestrate-workflow.ts) — DAG create + run + status.
- [`a2a-routing.ts`](./examples/a2a-routing.ts) — A2A JSON-RPC with trace propagation.
- [`health-monitoring.ts`](./examples/health-monitoring.ts) — hooks, circuit breaker, deep health.
- [`workers-agent/`](./examples/workers-agent/README.md) — Cloudflare Workers consumer.

See the [examples README](./examples/README.md) for prerequisites and how to run each one.

## Compatibility

This SDK targets the platform `fetch` API and has no Node-only dependencies.

| Runtime | Supported | Notes |
|---|---|---|
| **Node.js 20+**         | ✅ | LTS. `fetch` is global as of Node 18 and stable in 20. |
| **Bun**                 | ✅ | `fetch` + Web Streams built in. |
| **Deno**                | ✅ | Install via `npm:@nexartis/homeport-sdk`. |
| **Cloudflare Workers**  | ✅ | See [`examples/workers-agent`](./examples/workers-agent/README.md). No `nodejs_compat` required for core calls. |
| **Browsers with `fetch`** | ✅ | Any ES2022 target; CORS must be enabled on the Homeport node. |

ES2022 module output, `"type": "module"`, ships `.d.ts` + sourcemaps.

## Contributing

We welcome contributions from the community. Read [CONTRIBUTING.md](./CONTRIBUTING.md) for the development workflow, coding conventions, testing requirements, and review process.

The standard local gate is `pnpm run validate` (tests, build, docs, and size). The docs site can be deployed to dev with `pnpm run deploy:dev`; use `pnpm run deploy:prod` only on the release-owner/final-audit path after validation has passed.

All commits must be signed off under the [Developer Certificate of Origin](https://developercertificate.org/) — run `git commit -s` to add the required `Signed-off-by:` trailer. A DCO status check is enforced on every pull request.

Please also review our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Governance

Project direction, maintainer responsibilities, and the decision-making process are documented in [GOVERNANCE.md](./GOVERNANCE.md).

## Security

To report a vulnerability, please follow the disclosure process in [SECURITY.md](./SECURITY.md). **Do not** file public GitHub issues for security reports.

## Managed Homeport

Homeport is fully self-hostable and Apache-2.0 — the code in this repo and the [Homeport runtime](https://github.com/Nexartis/homeport) is the complete node; nothing is held back for a hosted tier.

If you'd rather not operate it yourself, **[Cubicube](https://cubicube.com)** offers managed Homeport nodes: one-click deploy, dedicated edge footprint, and a trust-plane console on top of the same open-source runtime.

Same SDK, same wire protocol — point `HomeportClient` at your self-hosted node or your Cubicube tenant.

## License

Released under the **Apache License, Version 2.0**. See [LICENSE](./LICENSE) for the full text and [NOTICE](./NOTICE) for attribution requirements.

```
Copyright (c) 2025-2026 Nexartis, LLC and contributors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0
```
