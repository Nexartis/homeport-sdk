# Nexartis NANDA Node SDK Issues and Audit Findings

## Executive summary

This register tracks remaining open gaps, blockers, and post-merge verification items only. Completed audit findings were removed from this issue register to keep PR review clean and DRY; completed evidence remains in the PR body and workspace trackers.

## Remaining issues

| ID | Status | Area | Finding | Follow-up |
| --- | --- | --- | --- | --- |
| NNN-SDK-AUDIT-010 | Open | Issue register | No Playwright coverage exists for the public docs site. | Add lightweight public docs-site smoke tests before treating browser E2E as complete. |
| NNN-SDK-AUDIT-011 | Open | Issue register | No automated accessibility smoke coverage exists for the docs landing page. | Add keyboard/role/label smoke checks for install tabs, copy button, navigation, and API link. |
| NNN-SDK-AUDIT-012 | Open | Issue register | There is no dedicated lint or format check; current lightweight gate is TypeScript typecheck plus tests. | Decide whether to add a formatter/linter or document typecheck-only as intentional. |
| NNN-SDK-AUDIT-013 | Open | Issue register | Tests mock SDK behavior but do not verify against a published server contract fixture. | Add contract tests once a canonical NANDA Node API contract is published. |
| NNN-SDK-AUDIT-014 | Open | Issue register | Package audit and dependency update status must be rechecked each recurring audit; the example subpackage does not have its own lockfile. | Keep root and docs-site lockfiles current; consider workspace normalization if examples start carrying independent dependency trees. |
| NNN-SDK-AUDIT-017 | Open | Issue register | `pnpm install` reports pnpm's ignored-build-scripts warning for build-time packages such as esbuild, sharp, and workerd. | Decide whether this repo should document an approved-builds policy; validation, size checks, dev deploy, and final prod deploy pass without approving scripts. |
| Dependency/security/code-scanning | Open | Dependency/security/code-scanning | Dependency/security/code-scanning Current status/impact: Open for default-branch Dependabot rescan | Tracker marks dependency/security audits pass/pass. GitHub metadata reports 4 open npm Dependabot alerts on the default branch (1 high, 2 medium, 1 low) and 0 open code-scanning alerts. Final audit `pnpm audit --audit-level high` exits 0. |

## Closure rule

Move an item out of this file only after the work is merged, validated, and any required GitHub/Dependabot or deployment rescan has confirmed the issue is no longer active.
