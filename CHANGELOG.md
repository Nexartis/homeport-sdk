# Changelog

All notable changes to the Homeport SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Pre-rebrand history for the predecessor package `@nexartis/nexartis-nanda-node-sdk` (≤ 1.3.0) is archived in [`CHANGELOG.pre-homeport.md`](./CHANGELOG.pre-homeport.md).

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
