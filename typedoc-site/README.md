# @nexartis/nexartis-nanda-node-sdk — docs site

This folder contains the Cloudflare Worker that serves the TypeDoc-generated
API reference for `@nexartis/nexartis-nanda-node-sdk`.

- **Production:** https://sdk.nandanetwork.link
- **Development:** https://sdk-dev.nandanetwork.link

The Worker uses a [static-assets
binding](https://developers.cloudflare.com/workers/static-assets/) to serve
everything from `./dist/`:

```
dist/
  index.html      ← branded landing page (copied from public/index.html)
  api/            ← TypeDoc output (entry point: src/index.ts)
```

## Local preview

From the repository root:

```bash
pnpm install
pnpm run build                 # resolve .d.ts for TypeDoc
pnpm run docs                  # generate dist/api via typedoc.json
cp typedoc-site/public/index.html typedoc-site/dist/index.html
pnpm --filter @nexartis/nexartis-nanda-node-sdk-docs-site run dev
```

> The `docs` script is owned by the root `package.json` (added by SDK Agent D).
> See the PR description for the exact additions it needs.

## Deploying

Per Nexartis conventions, always deploy via `pnpm run deploy:dev` or
`pnpm run deploy:prod` from inside `typedoc-site/`:

```bash
pnpm --filter @nexartis/nexartis-nanda-node-sdk-docs-site run deploy:dev
pnpm --filter @nexartis/nexartis-nanda-node-sdk-docs-site run deploy:prod
```

CI deploys prod automatically on release; see
`.github/workflows/deploy-docs.yml`.

## DNS setup (one-time per environment)

Both custom hostnames are declared in `wrangler.jsonc` as Worker custom
domains. Before the first deploy of each environment, make sure the zone
`nandanetwork.link` exists in the same Cloudflare account and that the
following records are *not* already claimed by other Workers:

| Environment | Hostname                     | Worker name                          |
| ----------- | ---------------------------- | ------------------------------------ |
| dev         | `sdk-dev.nandanetwork.link`  | `nexartis-nanda-node-sdk-docs-dev`   |
| prod        | `sdk.nandanetwork.link`      | `nexartis-nanda-node-sdk-docs`       |

Wrangler provisions the custom-hostname record on first successful deploy.

## Required CI secrets

`.github/workflows/deploy-docs.yml` uses:

- `CLOUDFLARE_API_TOKEN` — scoped to `Edit Workers` + `Workers Routes:Edit`
  on the `nandanetwork.link` zone.
- `CLOUDFLARE_ACCOUNT_ID` — the Nexartis Cloudflare account ID.
