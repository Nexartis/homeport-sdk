# Contributing to the Nexartis NANDA Node SDK

Thanks for your interest in contributing. This document covers the local
development setup, branch model, commit conventions, the Developer Certificate
of Origin (DCO) sign-off, how to run the tests, and where to find the RFC
process for substantial changes.

## Development setup

Prerequisites:

- **Node.js 20** (LTS). The repo pins an exact version in `.node-version`.
- **pnpm 10** (`corepack enable && corepack prepare pnpm@10 --activate`).

Bootstrap the workspace:

```bash
pnpm install
pnpm run build      # tsc --project tsconfig.json
pnpm run typecheck  # tsc --noEmit
pnpm run test       # vitest run
```

The `/core` entry point is designed to be dependency-free and runnable in
Node 20+, Bun, Deno, Cloudflare Workers, and modern browsers. Any new runtime
dependency added under `src/core/**` must be reviewed by a maintainer.

## Branch model

- `prod` — deployed/released state. Protected.
- `dev` — integration branch. Protected. PRs target this branch.
- `feat/*`, `fix/*`, `chore/*`, `docs/*` — short-lived feature branches off
  `dev`.

Workflow:

1. Branch off the latest `dev`.
2. Open a PR targeting `dev`.
3. Merge to `dev` after review + green CI. `prod` is updated via release PRs.

If another contributor is already working on a shared branch, pull before
pushing and rebase rather than force-pushing.

## Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org/) so
`release-please` can generate the changelog and SemVer bumps automatically.

Common types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`,
`build`, `ci`. Breaking changes use `!` after the type or a `BREAKING CHANGE:`
footer. Examples:

```
feat(agents): add list() pagination cursor
fix(retry): handle Retry-After header with HTTP dates
docs: clarify Workers compatibility in README
```

## DCO sign-off (required on every commit)

This project uses the [Developer Certificate of Origin](https://developercertificate.org/)
(DCO) instead of a CLA. Every commit must carry a `Signed-off-by:` trailer
that matches your name and email.

Sign off automatically when you commit:

```bash
git commit -s -m "feat(agents): add list() pagination cursor"
```

The `-s` flag adds a trailer like:

```
Signed-off-by: Jane Doe <jane@example.com>
```

If you forget, amend the last commit with `git commit --amend -s --no-edit`
or rewrite a branch with `git rebase --signoff dev`. The `dco` check on every
PR will block merges that are missing the trailer.

## Running the tests

- `pnpm run test` — full suite (vitest, run-once).
- `pnpm run test:watch` — watch mode during development.
- `pnpm run typecheck` — TypeScript project check, no emit.
- `pnpm run lint` — lint and format check.

Please add or update tests for any behavior change. PRs that touch runtime
code without corresponding tests will be asked to add them.

## Proposing substantial changes — RFC process

For breaking changes, new public APIs, or anything that meaningfully affects
downstream consumers, follow the RFC process documented in
[GOVERNANCE.md](./GOVERNANCE.md#rfc-process-for-breaking-changes). Small,
additive fixes and internal refactors do not require an RFC.

## Code of Conduct

Participation in this project is governed by our
[Code of Conduct](./CODE_OF_CONDUCT.md). Report violations to
`conduct@nexartis.com`.

## Reporting security issues

Security vulnerabilities follow coordinated disclosure — see
[SECURITY.md](./SECURITY.md). Do not open public issues for suspected
security bugs.

## License

By contributing, you agree that your contributions will be licensed under the
[Apache License, Version 2.0](./LICENSE), and that you have the right to
submit them under that license (as asserted by your DCO sign-off).
