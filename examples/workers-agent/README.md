# workers-agent

Minimal [Cloudflare Workers](https://developers.cloudflare.com/workers/) consumer
of [`@nexartis/nexartis-nanda-node-sdk`](https://www.npmjs.com/package/@nexartis/nexartis-nanda-node-sdk).

One route — `GET /health` — uses `NnnClient` to call the NANDA Node
`deepHealth()` endpoint from the edge and returns the JSON result.

## Prerequisites

- Node 20+ and `pnpm`
- A Cloudflare account authenticated locally (`wrangler login`)
- A NANDA Node API key

## Install

```bash
cd examples/workers-agent
pnpm install
```

## Configure

Set the API key as a secret (not committed to the repo):

```bash
wrangler secret put NNN_API_KEY
```

The base URL defaults to `https://nanda.nexartis.com` via `wrangler.jsonc`
`vars`. Override it per-environment by adding an `env.*` block or by running
`wrangler dev --var NNN_BASE_URL:https://your-node`.

## Run locally

```bash
pnpm run dev
curl http://localhost:8787/health
```

## Deploy

```bash
pnpm run deploy
```

See the top-level [examples index](../README.md) for more examples.
