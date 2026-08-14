# @nexartis/homeport-sdk — docs site

This folder contains the Cloudflare Worker that serves the TypeDoc-generated
API reference for `@nexartis/homeport-sdk`.

- **Production:** https://homeport-sdk.nexartis.com
- **Development:** https://homeport-sdk-dev.nexartis.com

The Worker uses a [static-assets
binding](https://developers.cloudflare.com/workers/static-assets/) to serve
everything from `./dist/`:

```
dist/
  index.html      ← branded landing page (copied from public/index.html)
  assets/         ← landing.css + landing.js (copied from public/assets/)
  api/            ← TypeDoc output (entry point: src/index.ts)
```

The legacy `nnn-sdk[-dev].nexartis.com` hostnames are served by the sibling
`../redirect-worker/` package (301 → homeport-sdk[-dev]) for the announced
deprecation window.

## Local preview

From the repository root:

```bash
pnpm install
pnpm run build                 # resolve .d.ts for TypeDoc
pnpm run docs:stage            # generate dist/api and copy landing assets
cd typedoc-site && pnpm run dev
```

> The `docs` script is defined in the root `package.json` and runs TypeDoc
> against `src/index.ts` using settings from `typedoc.json` at the repo root.

## End-to-end tests

Playwright smoke suite lives in `tests/`:

```bash
cd typedoc-site && pnpm run test:e2e
```

The suite exercises the landing page (title, install tabs, copy button,
TypeDoc `/api/` index) and the redirect worker's fetch handler in-process
via Vitest. Live-domain 301 verification is a post-deploy step (see the
audit finding NNN-SDK-AUDIT-010 checklist in the wave doc).

## Deploying

Per Nexartis conventions, deploy from the repository root so the SDK build,
TypeDoc output, and landing page assets are staged first:

```bash
pnpm run deploy:dev
pnpm run deploy:prod
```

For audits, run only `pnpm run deploy:dev`; production deploys are release-owner
work.

CI deploys prod automatically on release; see
`.github/workflows/deploy-docs.yml`.

## DNS setup (one-time per environment)

Both custom hostnames are declared in `wrangler.jsonc` as Worker custom
domains. Before the first deploy of each environment, make sure the zone
`nexartis.com` exists in the same Cloudflare account and that the
following records are *not* already claimed by other Workers:

| Environment | Hostname                          | Worker name             |
| ----------- | --------------------------------- | ----------------------- |
| dev         | `homeport-sdk-dev.nexartis.com`   | `homeport-sdk-docs-dev` |
| prod        | `homeport-sdk.nexartis.com`       | `homeport-sdk-docs`     |

Wrangler provisions the custom-hostname record on first successful deploy.

## Required CI secrets

`.github/workflows/deploy-docs.yml` uses:

- `CLOUDFLARE_API_TOKEN` — scoped to `Edit Workers` + `Workers Routes:Edit`
  on the `nexartis.com` zone.
- `CLOUDFLARE_ACCOUNT_ID` — the Nexartis Cloudflare account ID.
