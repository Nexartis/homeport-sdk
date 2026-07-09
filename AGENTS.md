# @nexartis/nexartis-nanda-node-sdk — Agent Instructions

Official TypeScript SDK for the Nexartis NANDA Node. Public package on
npm as `@nexartis/nexartis-nanda-node-sdk`, docs deployed to
`nnn-sdk.nexartis.com`. This repo is the strongest baseline among the
Nexartis SDKs — treat it as the reference for structure and tooling.

Repo-specific rules layer on top of the workspace `AGENTS.md`
(`_NEXARTIS-SDKs/../AGENTS.md`). Read that first.

## Ground rules

- **Do not rename the package.** `@nexartis/nexartis-nanda-node-sdk` is
  published with npm provenance; renaming breaks consumers and the
  provenance chain.
- **Preserve the public API.** Everything exported from `src/index.ts`
  and `src/core/index.ts` is public surface. Additions require a
  minor bump via release-please; breaking changes require a major
  bump and a Conventional Commit footer (`BREAKING CHANGE:`).
- **Do not disrupt release automation.** Files that release-please,
  npm provenance, docs deploy, and DCO depend on:
  - `.release-please-manifest.json`, `release-please-config.json`
  - `package.json` `version`, `publishConfig.provenance`, `files`
  - `.github/workflows/{release-please,publish,deploy-docs,dco}.yml`
  - `CHANGELOG.md` (managed by release-please)
  Never hand-edit these outside of a deliberate release-tooling
  change.
- **DCO required.** Every commit must be signed off
  (`git commit -s`). PRs from unsigned commits fail `dco.yml`.
- **Conventional Commits** drive versioning. `feat:` → minor,
  `fix:` → patch, `feat!:` / `BREAKING CHANGE:` → major, `chore:` /
  `docs:` / `test:` → no release.

## Layout

- `src/index.ts` — top-level barrel; re-exports the public API.
- `src/core/` — HTTP client, errors, retry, circuit breaker, logger,
  SSE, namespace helpers, types, version. Colocated `*.test.ts`.
- `src/core/namespaces/` — per-namespace API surfaces.
- `docs/` — hand-written product/architecture/testing docs.
- `typedoc-site/` — Cloudflare Worker that serves TypeDoc output
  from `typedoc-site/dist/` at `nnn-sdk.nexartis.com`.
- `examples/` — runnable usage examples.
- `dist/` — build output (gitignored, published to npm).

## Commands

- `pnpm run typecheck` — `tsc --noEmit`.
- `pnpm run test` — `vitest run` over `src/**/*.test.ts`.
- `pnpm run build` — emit `dist/` via `tsc`.
- `pnpm run docs` — TypeDoc → `typedoc-site/dist/api/`.
- `pnpm run size` — enforce `.size-limit.json` budgets against
  `dist/**` (root ≤ 80 KB, `/core` ≤ 50 KB).
- `pnpm run validate` — the full local gate:
  `typecheck && test && build && docs && size`. Run this before
  opening a PR.

`prepack` runs `clean && build`; `prepublishOnly` runs `build`. Do
not remove either — npm provenance publishes from a clean build.

## Testing

Vitest, Node environment, globals enabled. Test files live next to
sources as `src/**/*.test.ts` and are excluded from the emitted
`dist/`. Add coverage locally with `vitest --coverage` if needed;
coverage is not yet wired into `validate` (see Deferred below).

## Size budgets

`.size-limit.json` guards published bundle size. Adjust budgets in
the same PR that legitimately grows the surface — don't silently
raise limits to hide regressions.

## Docs deploy

`typedoc-site/` is a Cloudflare Worker. `pnpm run deploy:dev` /
`deploy:prod` build, stage `typedoc-site/dist/`, and deploy via
Wrangler. The `deploy-docs.yml` workflow owns production; local
deploys are for previews only.

## Deferred / not in scope for foundation baseline

- **Coverage in `validate`.** Adding `@vitest/coverage-v8` changes
  the lockfile and CI shape; defer to a dedicated PR.
- **Rename or restructure `src/core/namespaces/`.** Public API.
- **Workflow changes** (`ci.yml`, `publish.yml`, etc.). Out of scope
  for baseline cleanup.
