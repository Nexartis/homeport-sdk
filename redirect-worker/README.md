# @nexartis/homeport-sdk-legacy-redirect

Cloudflare Worker that serves **HTTP 301** redirects from the legacy
Homeport SDK documentation hostnames to the current ones, preserving
path and query:

| Environment | Legacy hostname               | Target                               |
| ----------- | ----------------------------- | ------------------------------------ |
| dev         | `nnn-sdk-dev.nexartis.com`    | `https://homeport-sdk-dev.nexartis.com` |
| prod        | `nnn-sdk.nexartis.com`        | `https://homeport-sdk.nexartis.com`  |

## Why this exists

The SDK was renamed from `nexartis-nanda-node-sdk` to `homeport-sdk`
(product name: **Homeport** — the open-source self-hostable NANDA
node). Legacy links (blogs, `README`s, chat archives, search-engine
results) still point at `nnn-sdk[-dev].nexartis.com`.

Rather than break those, we serve permanent redirects. Search engines
consolidate PageRank onto the new origin, and users land on the
current docs without a manual step.

## Deprecation window

Planned lifetime: **6–12 months** from the rebrand cut-over. The
window is reviewed each quarter; once traffic to `nnn-sdk*` drops
below noise, the custom domains are released and this worker is
retired. Track the decommission ticket in the SDK issues.

## Deploy

Each environment is explicit — no root-level routes/vars.

```bash
cd redirect-worker
pnpm install                 # once, to pull wrangler
pnpm run deploy:dev          # publishes to nnn-sdk-dev.nexartis.com
pnpm run deploy:prod         # publishes to nnn-sdk.nexartis.com
```

Deploys are release-owner work; audits run only `deploy:dev`.

## Post-deploy verification

```bash
curl -sSI https://nnn-sdk-dev.nexartis.com/api/ \
  | grep -iE '^(HTTP|location|cache-control)'
# Expect:  HTTP/2 301
#          location: https://homeport-sdk-dev.nexartis.com/api/
#          cache-control: public, max-age=3600, must-revalidate
```

Repeat for the production hostname after the prod deploy.

## Tests

The fetch handler is exercised in-process by the docs-site vitest
suite at `../typedoc-site/tests/redirect-worker.spec.ts` (part of
`pnpm --filter @nexartis/homeport-sdk-docs-site run test:e2e`). Live
301 verification is a post-deploy step, not part of the unit run.
