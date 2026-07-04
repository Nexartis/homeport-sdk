# Nexartis NANDA Node SDK Roadmap

## Executive summary

This roadmap captures future-facing work discovered during the full agentic audit. Current product behavior belongs in `PRODUCT_ARCHITECTURE.md`; current gaps and risks belong in `ISSUES.md`.

## Near-term roadmap

| Theme | Candidate work | Why it matters |
|---|---|---|
| Documentation confidence | Add Playwright smoke checks for the docs landing page and generated API reference. | The repo now has a deployable public docs site but no browser-level regression coverage. |
| Accessibility confidence | Add a lightweight accessibility smoke test for the docs landing page. | The public docs site has interactive install tabs and copy controls. |
| Developer experience | Decide whether to add a dedicated formatter/linter or continue using TypeScript as the lightweight check gate. | Current CI is right-sized but does not enforce formatting beyond TypeScript compilation. |
| Version automation | Generate `src/core/version.ts` from `package.json` during release or validation. | Avoid future drift between package metadata and runtime User-Agent/version exports. |

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

## Nexartis Voice-First 1.0 T1 items

This roadmap now feeds the coordinated **`Nexartis Voice-First 1.0 T1`** release train documented in the workspace-level `MASTER-RELEASE-ROADMAP.md`. The SDK adds thin client methods for the new NANDA A2A delegation actions that back the train's PUH + delegation stack.

| Item | Wave | Ships |
|------|------|-------|
| `NND-SDK-D1` | 2 | Client methods for the new A2A actions in `nexartis-nanda-node` Wave 2 `NND-D1`: `client.orchestration.grantDelegation(input)`, `client.orchestration.revokeDelegation(delegationId, reason)`, `client.orchestration.checkDelegation(delegationId)`. Types published as `DelegationGrantRequest`, `DelegationGrantResult`, `DelegationRevokeResult`, `DelegationCheckResult` in `src/core/types.ts`. Follows the existing `delegateTask` shape (`src/core/namespaces/orchestration.ts:129`). Works unchanged on Node/Bun/Deno/Workers/browsers per current SDK targets. |

Cross-repo dependencies (Voice-First 1.0 T1):

- `NND-SDK-D1` **depends on** `nexartis-nanda-node` Wave 2 `NND-D1` shipping the A2A actions first. Hard predecessor; do not sign off Wave 2 SDK exit until the NANDA node Wave 2 gate is `GREEN`.
- **Consumed by** `nexartis-remote-control-client` (`connector/tools/agent-delegation.mjs`) for PUH-attested delegation grants at Wave 3 `PUH-4`.
