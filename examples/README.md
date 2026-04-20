# Examples

Runnable examples for `@nexartis/nexartis-nanda-node-sdk`. Each `.ts` file is
self-contained and uses the public package name, so you can copy it into your
own project verbatim after `pnpm add @nexartis/nexartis-nanda-node-sdk`.

All examples are licensed under **Apache-2.0** (see SPDX header at top of
each file).

## Prerequisites

- Node 20+ (or Bun / Deno with `fetch`)
- An API key for a reachable NANDA Node — export as `NNN_API_KEY`

```bash
export NNN_API_KEY="nnn_..."
```

## Running locally from a checkout

From the repo root:

```bash
pnpm install
pnpm run build      # compiles src/ to dist/
npx tsx examples/<example>.ts
```

> The examples import from `@nexartis/nexartis-nanda-node-sdk`. When running
> from inside this repo, pnpm workspace resolution points that specifier at
> the local package, so no extra setup is required.

## Index

| File | What it demonstrates |
|------|----------------------|
| [`register-and-discover.ts`](./register-and-discover.ts) | Register an agent, search by capability, auto-paginate results, lookup by id. |
| [`orchestrate-workflow.ts`](./orchestrate-workflow.ts) | Build a DAG workflow, run it, inspect step status, list workflows. |
| [`a2a-routing.ts`](./a2a-routing.ts) | Best-match agent routing + A2A JSON-RPC with W3C trace propagation. |
| [`health-monitoring.ts`](./health-monitoring.ts) | Lifecycle hooks, circuit breaker, deep health, index diff + subscribe. |
| [`workers-agent/`](./workers-agent) | Minimal Cloudflare Workers consumer that calls the SDK from the edge. |

## Full API reference

Generated TypeDoc for every public export is hosted at
<https://nnn-sdk.nexartis.com>.
