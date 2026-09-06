# Changelog

All notable changes to the Homeport SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Pre-rebrand history for the predecessor package `@nexartis/nexartis-nanda-node-sdk` (≤ 1.3.0) is archived in [`CHANGELOG.pre-homeport.md`](./CHANGELOG.pre-homeport.md).

## [1.2.3](https://github.com/Nexartis/homeport-sdk/compare/v1.2.2...v1.2.3) (2026-09-04)


### Bug Fixes

* install typedoc-site before test:e2e ([c523dfd](https://github.com/Nexartis/homeport-sdk/commit/c523dfd3ca8088e3fbc1c717c2f145023278aa18))
* make docs E2E self-contained ([5b1caa2](https://github.com/Nexartis/homeport-sdk/commit/5b1caa26a4d11a56a94c567e99140c077d34debd))

## [1.2.2](https://github.com/Nexartis/homeport-sdk/compare/v1.2.1...v1.2.2) (2026-08-24)


### Bug Fixes

* regenerate SDK_VERSION to 1.2.1 ([093275f](https://github.com/Nexartis/homeport-sdk/commit/093275f25b7837d7d3196cee62fcf8ff0c3ff915))
* regenerate SDK_VERSION to 1.2.1 ([3021a23](https://github.com/Nexartis/homeport-sdk/commit/3021a23237ff60e94c9380a58db63aa6017029e9))

## [1.2.1](https://github.com/Nexartis/homeport-sdk/compare/v1.2.0...v1.2.1) (2026-08-24)


### Bug Fixes

* **docs:** grant.delegationId; npm 11; retag v1.2.0 ([76ad56d](https://github.com/Nexartis/homeport-sdk/commit/76ad56d8c2bdc3593f578d285ae05d0487e28613))
* **docs:** grant.delegationId; npm 11; retag v1.2.0 ([2d1f678](https://github.com/Nexartis/homeport-sdk/commit/2d1f678d252b4e8edd54b4fd135007b527831447))

## [1.2.0](https://github.com/Nexartis/homeport-sdk/compare/v1.1.1...v1.2.0) (2026-08-22)


### Features

* compose Homeport A2A fields from authority-grant/1 ([d7808b3](https://github.com/Nexartis/homeport-sdk/commit/d7808b3be84b37a66cf0eafbe5b177c0f01ce630))
* Wave 2.4 compose Homeport A2A from authority-grant/1 ([1f26f30](https://github.com/Nexartis/homeport-sdk/commit/1f26f30c2f58b4ecd74d4a0f9eb14c1f16df8ac1))

## [1.1.1](https://github.com/Nexartis/homeport-sdk/compare/v1.1.0...v1.1.1) (2026-08-21)


### Bug Fixes

* align docs Node engine with Vite ([0bffc25](https://github.com/Nexartis/homeport-sdk/commit/0bffc25d17351711104d1222404c12f4f57095b8))
* align docs Node engine with Vite ([b5051a4](https://github.com/Nexartis/homeport-sdk/commit/b5051a491c1fb80b2e6ba929c5717479976b3cf7))
* **orchestration:** require PUH proof on delegation.grant ([a8ce251](https://github.com/Nexartis/homeport-sdk/commit/a8ce251a97c2a94db6e478c0380b6d83b82b6084))
* **orchestration:** require PUH proof on delegation.grant ([2aea4e0](https://github.com/Nexartis/homeport-sdk/commit/2aea4e02c397e98e0726997ffd4bc52648c8f535))

## [1.1.0] - 2026-08-13

### Added

- Visibility lifecycle, capability/MCP/pricing metadata, and trust-badge contracts (Set C / `#50`): `AgentVisibility`, `PricingDescriptor`, `CapabilityManifestEntry`, `McpMetadata`, `TrustBadge*` types; `trust.getBadges()`; `visibility` / `for_hire` search filters; signed AgentAddr passthrough on `RegisterAgentRequest`.
- Tag-from-`dev` publish path for `@nexartis/homeport-sdk`. `publish.yml` runs only on a `v*.*.*` tag that matches `package.json` version, refuses any other package name, and creates the GitHub Release for that tag. `release-please.yml` stays on nanda `prod` until a follow-up after `v1.1.0` exists.

### Notes

- npmjs already has `@nexartis/homeport-sdk@1.0.0` (2026-07-18, pre-#50). This minor republishes the current `dev` surface. Do not merge Homeport `dev` onto nanda `prod` to ship it.
- Public exports stay Homeport-named (`HomeportClient`, `HomeportError`). There is no deprecated `Nnn*` alias.

## [1.0.0] - 2026-07-18

### Rebrand — `@nexartis/nexartis-nanda-node-sdk` → `@nexartis/homeport-sdk`

The SDK is republished as **`@nexartis/homeport-sdk`** 1.0.0. It supersedes `@nexartis/nexartis-nanda-node-sdk` (last published as 1.2.1 on npm; the internal 1.3.0 line never shipped). The wire protocol, namespace surface, and error semantics are unchanged — only names, env vars, log prefix, and docs domain moved.

#### Added

- New package identity: `@nexartis/homeport-sdk` published on npmjs with SLSA provenance from `Nexartis/homeport-sdk`.
- Public docs site at **<https://homeport-sdk.nexartis.com>** (dev: `homeport-sdk-dev.nexartis.com`).
- `redirect-worker/` — Cloudflare Worker that 301-redirects legacy `nnn-sdk[-dev].nexartis.com` hostnames to the new docs origin for the announced deprecation window.
- `.github/workflows/deploy-redirect.yml` — deploys the redirect worker on push to `prod`.
- `scripts/gen-version.mjs` and `prebuild` script — `src/core/version.ts` is now regenerated from `package.json` on every build, eliminating the version-drift class of bugs.
- Playwright coverage under `typedoc-site/tests/` for the public docs landing page and generated API reference (resolves `NNN-SDK-AUDIT-010`).
- Namespace-level unit tests: `src/core/namespaces/{agents,orchestration,trust}.test.ts` — 202 tests green.
- `docs/REBRAND-RUNBOOK.md` — operator checklist for the migration (repo rename, tag relocation, custom-domain provisioning, publish gate, deprecate, downstream doc updates).

#### Changed — symbol and env migration

| Old (pre-1.0.0) | New (1.0.0) |
|---|---|
| `NnnClient` | `HomeportClient` |
| `NnnError` | `HomeportError` |
| `NnnErrorCode` | `HomeportErrorCode` |
| `NnnErrorContext` | `HomeportErrorContext` |
| `createNnnLogger`, `NnnLogger` | `createHomeportLogger`, `HomeportLogger` |
| `NNN_*` environment variables (e.g. `NNN_API_KEY`) | `HOMEPORT_*` (e.g. `HOMEPORT_API_KEY`) |
| Log prefix `[nnn-sdk]` | `[homeport-sdk]` |
| Docs domain `nnn-sdk.nexartis.com` | `homeport-sdk.nexartis.com` (legacy hostnames 301 during the deprecation window) |
| Repository `github.com/Nexartis/nexartis-nanda-node-sdk` | `github.com/Nexartis/homeport-sdk` |

#### Deprecated

- `@nexartis/nexartis-nanda-node-sdk` on npm is marked deprecated with a pointer to `@nexartis/homeport-sdk`. See [`docs/REBRAND-RUNBOOK.md`](./docs/REBRAND-RUNBOOK.md) for the exact `npm deprecate` command and downstream update sequence.

#### Notes

- Version number resets. `1.0.0` reflects the fresh package identity on npm, not a rewrite of the underlying code — consumers migrating from `@nexartis/nexartis-nanda-node-sdk@1.2.1` will find the runtime API source-compatible after applying the symbol migration above.
- Historical audit findings keep their `NNN-SDK-AUDIT-###` IDs in `docs/ISSUES.md` for provenance.
