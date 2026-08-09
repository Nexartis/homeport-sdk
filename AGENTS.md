# @nexartis/homeport-sdk — Agent Instructions

Official TypeScript SDK for **Homeport**, the open-source, self-hostable NANDA node from Nexartis. Public package on npm as `@nexartis/homeport-sdk`, docs deployed to `homeport-sdk.nexartis.com`. This repo is the strongest baseline among the Nexartis SDKs — treat it as the reference for structure and tooling.

Repo-specific rules layer on top of the workspace `AGENTS.md` when this repo is checked out inside the Nexartis platform workspace. For a standalone checkout, this file is the source of truth.

## Ground rules

- **Package identity is now stable at `@nexartis/homeport-sdk` 1.0.0.** The predecessor `@nexartis/nexartis-nanda-node-sdk` (final published 1.2.1) is `npm deprecate`d with a pointer to this package. Renaming again would break consumers and the provenance chain; do not do it without a fresh operator-approved rebrand plan and a full runbook update in `docs/REBRAND-RUNBOOK.md`.
- **Brand vocabulary.** *Homeport* is the product (the node and this SDK). *NANDA* is the protocol — keep it in Project NANDA and MIT Media Lab attribution only. *Nexartis* is the publisher. Do not backslide brand terms in READMEs, comments, or logs.
- **Preserve the public API.** Everything exported from `src/index.ts` and `src/core/index.ts` is public surface. Additions require a minor bump via release-please; breaking changes require a major bump and a Conventional Commit footer (`BREAKING CHANGE:`).
- **SDK version comes from `package.json`.** `scripts/gen-version.mjs` regenerates `src/core/version.ts` (wired as `prebuild`). Do not hand-edit `src/core/version.ts`; bump `package.json` (or let release-please do it) and rerun `pnpm run build`.
- **Do not disrupt release automation.** Files that release-please, npm provenance, docs deploy, and DCO depend on:
  - `.release-please-manifest.json`, `release-please-config.json`
  - `package.json` `version`, `publishConfig.provenance`, `files`
  - `.github/workflows/{release-please,publish,deploy-docs,deploy-redirect,dco}.yml`
  - `CHANGELOG.md` (managed by release-please) and archived `CHANGELOG.pre-homeport.md`
  Never hand-edit these outside of a deliberate release-tooling change.
- **DCO required.** Every commit must be signed off (`git commit -s`). PRs from unsigned commits fail `dco.yml`.
- **Conventional Commits** drive versioning. `feat:` → minor, `fix:` → patch, `feat!:` / `BREAKING CHANGE:` → major, `chore:` / `docs:` / `test:` → no release.

## Layout

- `src/index.ts` — top-level barrel; re-exports the public API.
- `src/core/` — HTTP client, errors, retry, circuit breaker, logger, SSE, namespace helpers, types, version. Colocated `*.test.ts`.
- `src/core/namespaces/` — per-namespace API surfaces.
- `scripts/gen-version.mjs` — generates `src/core/version.ts` from `package.json` (wired as `prebuild`).
- `docs/` — hand-written product/architecture/testing docs plus `REBRAND-RUNBOOK.md` for the Homeport migration.
- `typedoc-site/` — Cloudflare Worker that serves TypeDoc output from `typedoc-site/dist/` at `homeport-sdk.nexartis.com`.
- `redirect-worker/` — sibling Cloudflare Worker that 301-redirects the legacy `nnn-sdk[-dev].nexartis.com` hostnames to `homeport-sdk[-dev].nexartis.com` for the deprecation window.
- `examples/` — runnable usage examples (all imports use `@nexartis/homeport-sdk` + `HomeportClient`).
- `dist/` — build output (gitignored, published to npm).

## Commands

- `pnpm run typecheck` — `tsc --noEmit`.
- `pnpm run test` — `vitest run` over `src/**/*.test.ts`.
- `pnpm run build` — emit `dist/` via `tsc` (runs `prebuild` → `gen-version.mjs` first).
- `pnpm run docs` — TypeDoc → `typedoc-site/dist/api/`.
- `pnpm run size` — enforce `.size-limit.json` budgets against `dist/**` (root ≤ 80 KB, `/core` ≤ 50 KB).
- `pnpm run validate` — the full local gate: `test && build && docs && size`. Run this before opening a PR. The emitting `build` performs the identical type check, so `typecheck` is not run separately in the gate; it remains available as a manual diagnostic.

`prepack` runs `clean && build`; `prepublishOnly` runs `build`. Do not remove either — npm provenance publishes from a clean build.

## Testing

Vitest, Node environment, globals enabled. Test files live next to sources as `src/**/*.test.ts` and are excluded from the emitted `dist/`. The `typedoc-site/tests/` Playwright suite covers the public docs landing page and generated API reference (resolves `NNN-SDK-AUDIT-010`). Add coverage locally with `vitest --coverage` if needed; coverage is not yet wired into `validate`.

## Size budgets

`.size-limit.json` guards published bundle size. Adjust budgets in the same PR that legitimately grows the surface — don't silently raise limits to hide regressions.

## Docs deploy

`typedoc-site/` is a Cloudflare Worker. `pnpm run deploy:dev` / `deploy:prod` build, stage `typedoc-site/dist/`, and deploy via Wrangler. The `deploy-docs.yml` workflow owns production; local deploys are for previews only. The sibling `redirect-worker/` ships via `deploy-redirect.yml` on push to `prod` touching `redirect-worker/**`.

## Legacy audit-ID convention

Historical audit findings retain their `NNN-SDK-AUDIT-###` prefix in `docs/ISSUES.md` for traceability across the pre-rebrand history — do not renumber them.

## Deferred / not in scope for foundation baseline

- **Coverage in `validate`.** Adding `@vitest/coverage-v8` changes the lockfile and CI shape; defer to a dedicated PR.
- **Rename or restructure `src/core/namespaces/`.** Public API.
- **Workflow changes** (`ci.yml`, `publish.yml`, etc.) beyond what the rebrand required. Out of scope for baseline cleanup.
