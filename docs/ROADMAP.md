# Homeport SDK Roadmap

## Executive summary

This roadmap captures future-facing work discovered during the full agentic audit. Current product behavior belongs in `PRODUCT_ARCHITECTURE.md`; current gaps and risks belong in `ISSUES.md`.

## Near-term roadmap

| Theme | Candidate work | Why it matters |
|---|---|---|
| Documentation confidence | Add Playwright smoke checks for the docs landing page and generated API reference. | The repo now has a deployable public docs site but no browser-level regression coverage. |
| Accessibility confidence | Add a lightweight accessibility smoke test for the docs landing page. | The public docs site has interactive install tabs and copy controls. |
| Developer experience | Decide whether to add a dedicated formatter/linter or continue using TypeScript as the lightweight check gate. | Current CI is right-sized but does not enforce formatting beyond TypeScript compilation. |
| Version automation (resolved 1.0.0) | `scripts/gen-version.mjs` generates `src/core/version.ts` from `package.json`; wired as `prebuild`. | Resolved by the Homeport rebrand; kept here for provenance. |

## Later roadmap

- Add contract tests against a stable NANDA Node mock or OpenAPI fixture when the server contract is published.
- Add example-level validation for `examples/workers-agent/` without requiring a live NANDA API key.
- Consider bundle-size trend reporting in PR comments if package size becomes a release risk.
- Publish a consumer migration guide for any future major SDK version.

## Open product questions

- Which NANDA Node environments should examples use by default for public documentation?
- Should browser consumers get a separately documented CORS troubleshooting guide?
- Should the docs site include a status banner when generated TypeDoc is stale relative to the package version?

## Deferred ideas

- Multi-runtime example matrix for Bun, Deno, Workers, and browser bundlers.
- Optional generated API contract snapshots once the server-side contract is stable.
- Automated link-checking for external Project NANDA, npm, GitHub, and Cubicube links.
