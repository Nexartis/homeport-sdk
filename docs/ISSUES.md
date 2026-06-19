# Nexartis NANDA Node SDK Issues and Audit Findings

## Executive summary

This file records every issue, discrepancy, risk, and follow-up found during the 2026-06-19 full agentic audit. Items marked fixed were resolved as minor documentation, convention, package metadata, or audit-truthfulness cleanup in this audit branch.

## Issue register

| ID | Status | Category | Finding | Resolution or follow-up |
|---|---|---|---|---|
| NNN-SDK-AUDIT-001 | Fixed | Documentation | Required repo docs under `docs/` were missing. | Added `PRODUCT_ARCHITECTURE.md`, `ROADMAP.md`, `ISSUES.md`, `TESTING.md`, `E2E_COVERAGE_MATRIX.md`, and `DOCUMENT_INVENTORY.md`. |
| NNN-SDK-AUDIT-002 | Fixed | Package scripts | Root package lacked the standard `validate` script. | Added `validate` as the safe local gate for typecheck, tests, build, docs generation, and size check. |
| NNN-SDK-AUDIT-003 | Fixed | Package scripts | Root package lacked root-level `deploy:dev` and `deploy:prod` helpers for the deployable TypeDoc site. | Added root deploy scripts that build, stage docs, and call the docs-site deployment scripts. Prod script exists for convention but was not run. |
| NNN-SDK-AUDIT-004 | Fixed | Public copy | Docs landing page claimed the SDK ships “pure ESM + CJS,” but `package.json` exports only ESM. | Updated public copy to say “typed ESM”. |
| NNN-SDK-AUDIT-005 | Fixed | Dependency metadata | `typedoc-site/package.json` lacked `packageManager` and `engines` metadata. | Added pnpm and Node metadata. |
| NNN-SDK-AUDIT-006 | Fixed | Example metadata | `examples/workers-agent` depended on `^1.1.0` while the root package is `1.2.2`. | Updated the example dependency to `^1.2.2`. |
| NNN-SDK-AUDIT-007 | Fixed | Deployment conventions | The Workers example exposed only a generic `deploy` script and comments, not dev/prod deploy conventions. | Added `deploy:dev` and `deploy:prod`, and documented explicit example environments. |
| NNN-SDK-AUDIT-008 | Fixed | Documentation accuracy | `CONTRIBUTING.md` said the repo pins Node 20, but `.node-version` is 22 and CI covers Node 20 and 22. | Updated setup text to describe Node 20+ support and Node 22 local default. |
| NNN-SDK-AUDIT-009 | Fixed | Runtime metadata accuracy | `SDK_VERSION` was `1.0.0` while `package.json` is `1.2.2`; this made runtime User-Agent/version exports stale. | Updated the constant to `1.2.2` and added a regression test. This is a minimal truthfulness fix, not a product behavior change. |
| NNN-SDK-AUDIT-010 | Open | Testing | No Playwright coverage exists for the public docs site. | Add lightweight public docs-site smoke tests before treating browser E2E as complete. |
| NNN-SDK-AUDIT-011 | Open | Accessibility | No automated accessibility smoke coverage exists for the docs landing page. | Add keyboard/role/label smoke checks for install tabs, copy button, navigation, and API link. |
| NNN-SDK-AUDIT-012 | Open | CI quality gates | There is no dedicated lint or format check; current lightweight gate is TypeScript typecheck plus tests. | Decide whether to add a formatter/linter or document typecheck-only as intentional. |
| NNN-SDK-AUDIT-013 | Open | API contracts | Tests mock SDK behavior but do not verify against a published server contract fixture. | Add contract tests once a canonical NANDA Node API contract is published. |
| NNN-SDK-AUDIT-014 | Open | Dependency governance | Package audit and dependency update status must be rechecked each recurring audit; the example subpackage does not have its own lockfile. | Keep root and docs-site lockfiles current; consider workspace normalization if examples start carrying independent dependency trees. |
| NNN-SDK-AUDIT-015 | Fixed | Documentation generation | TypeDoc emitted warnings because README linked to directories and a referenced switchboard type was missing from the public barrel. | Replaced directory links with file links and exported `SwitchboardExportFormat`; `pnpm run validate` now generates docs without warnings. |
| NNN-SDK-AUDIT-016 | Fixed | Dependency security | `pnpm audit --audit-level moderate` found high/moderate transitive advisories in Vite, markdown-it, and brace-expansion, plus a low esbuild advisory. | Added package-manager overrides and a direct patched Vite dev dependency; `pnpm audit --audit-level low` reports no known vulnerabilities. |
| NNN-SDK-AUDIT-017 | Open | Dependency governance | `pnpm install` reports pnpm's ignored-build-scripts warning for build-time packages such as esbuild, sharp, and workerd. | Decide whether this repo should document an approved-builds policy; validation, size checks, and dev deploy pass without approving scripts. |
| NNN-SDK-AUDIT-018 | Fixed | Dependency governance | Dev deployment warned that `typedoc-site` used outdated Wrangler 3. | Updated `typedoc-site` to Wrangler 4.102.0 and redeployed dev successfully. |

## Testing gaps

- Public docs-site Playwright coverage is missing.
- Authenticated Playwright coverage is not applicable to the SDK package or unauthenticated docs site.
- Example Worker behavior is documented but not covered by automated integration tests.

## Deployment and operations gaps

- Dev deployment should be run with `pnpm run deploy:dev` during this audit and recorded in the workspace tracker.
- Rollback for docs-site production deploys is currently GitHub/Cloudflare standard rollback, not a repo-specific runbook.

## Recurring audit notes

- Default recurrence: 90 days.
- Next audit should verify package version automation, docs-site browser smoke coverage, and dependency/security audit status.
