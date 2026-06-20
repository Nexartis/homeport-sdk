# Nexartis NANDA Node SDK Document Inventory

## Inventory summary

This inventory was created during the 2026-06-19 full agentic audit. Existing documents were preserved; useful current-state facts were mapped into the new canonical docs without deleting historical or governance material.

| Document | Classification | Status | Useful information and destination |
|---|---|---|---|
| `README.md` | Current public entry point | Keep as source of truth | Package overview, install, quickstart, feature/API summary, compatibility, examples, contribution/security links. Deep product architecture now lives in `docs/PRODUCT_ARCHITECTURE.md`. |
| `CHANGELOG.md` | Historical release log | Keep as source of truth | Historical release facts. Old `sdk.nandanetwork.link` references are historical, not current docs-site URLs. |
| `CONTRIBUTING.md` | Current contributor guide | Keep as source of truth | Local setup, branch model, DCO, tests, RFC pointers. Updated to align Node/version and validation wording. |
| `GOVERNANCE.md` | Current governance guide | Keep as source of truth | Maintainer responsibilities and RFC process. |
| `SECURITY.md` | Current security policy | Keep as source of truth | Vulnerability reporting, disclosure SLA, supported versions, provenance verification. Security summary linked from `ISSUES.md` and architecture docs. |
| `CODE_OF_CONDUCT.md` | Community policy | Keep as source of truth | Community behavior expectations. |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR checklist | Keep as source of truth | DCO, changelog, test, typecheck, size, API-change, and docs checklist. |
| `.github/ISSUE_TEMPLATE/*.yml` | Issue intake | Keep as source of truth | Bug, feature, question, and security routing. |
| `.github/workflows/ci.yml` | CI definition | Keep as source of truth | Node 20/22 typecheck, test, optional size gate. Reflected in `docs/TESTING.md`. |
| `.github/workflows/deploy-docs.yml` | Production docs deployment | Keep as source of truth | Prod docs deploy from `prod`; dev deploy remains local audit path via `pnpm run deploy:dev`. |
| `.github/workflows/publish.yml` | npm publish workflow | Keep as source of truth | OIDC Trusted Publishing, provenance, optional token fallback. |
| `.github/workflows/release-please.yml` | Release automation | Keep as source of truth | Release PR automation targeting `prod`. |
| `examples/README.md` | Example guide | Keep as source of truth | Runnable examples and prerequisites. |
| `examples/workers-agent/README.md` | Worker example guide | Keep as source of truth | Edge consumer example setup; deploy convention reflected in issues/testing docs. |
| `typedoc-site/README.md` | Docs-site deploy guide | Keep as source of truth | TypeDoc generation and Cloudflare dev/prod deploy path. |
| `typedoc.json` | Generated docs config | Keep as source of truth | API reference output path and plugin config. |
| `docs/PRODUCT_ARCHITECTURE.md` | Current product architecture | New canonical doc | Product capabilities, flows, boundaries, integrations, and security notes. |
| `docs/ROADMAP.md` | Future-facing plans | New canonical doc | Future improvements and open questions. |
| `docs/ISSUES.md` | Known gaps register | New canonical doc | All audit findings, fixed items, and open follow-ups. |
| `docs/TESTING.md` | Testing strategy | New canonical doc | Validation matrix, unit strategy, E2E applicability, and gaps. |
| `docs/E2E_COVERAGE_MATRIX.md` | Browser coverage matrix | New canonical doc | Docs-site public journey coverage and authenticated N/A statement. |

## Consolidation notes

- No existing Markdown files were deleted or archived in this audit.
- Historical changelog entries remain unchanged even when they reference prior docs domains.
- Future-facing items were moved to `ROADMAP.md`; current gaps and risks were moved to `ISSUES.md`.
