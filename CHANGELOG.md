# Changelog

All notable changes to the Homeport SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Pre-rebrand history for the predecessor package `@nexartis/nexartis-nanda-node-sdk` (≤ 1.3.0) is archived in [`CHANGELOG.pre-homeport.md`](./CHANGELOG.pre-homeport.md).

## [2.0.0](https://github.com/Nexartis/homeport-sdk/compare/v1.2.3...v2.0.0) (2026-09-06)


### ⚠ BREAKING CHANGES

* package renamed from @nexartis/nexartis-nanda-node-sdk; NnnClient->HomeportClient, NnnError->HomeportError, NnnErrorCode-> HomeportErrorCode; log prefix [homeport-sdk]; env NNN_*->HOMEPORT_*.

### Features

* ABI SDK integration hardening ([d4a4b23](https://github.com/Nexartis/homeport-sdk/commit/d4a4b23080c3b9334ede5fc4b16d2505c689140d))
* ABI SDK integration hardening ([5bc3a41](https://github.com/Nexartis/homeport-sdk/commit/5bc3a41e6707335a3235dd3ac0131bbbafbce3cc))
* backend alignment sprint A-D — conventions, infrastructure, coverage, and namespace refactor ([c99c395](https://github.com/Nexartis/homeport-sdk/commit/c99c395acdbc998784a07dda55a5c603105c9e60))
* backend alignment sprint B+C — conventions, infrastructure, and endpoint coverage ([5c88200](https://github.com/Nexartis/homeport-sdk/commit/5c8820011b31800ff10807af91097aa370b1698d))
* compose Homeport A2A fields from authority-grant/1 ([d7808b3](https://github.com/Nexartis/homeport-sdk/commit/d7808b3be84b37a66cf0eafbe5b177c0f01ce630))
* **D:** namespace refactor — organize flat API into logical namespaces ([32d3de5](https://github.com/Nexartis/homeport-sdk/commit/32d3de50d4dbd3f1948040e5919543b4252b5a75))
* **docs-site:** add typedoc config and in-repo Cloudflare Worker for sdk.nandanetwork.link ([6871314](https://github.com/Nexartis/homeport-sdk/commit/687131410fa7dc59fd5e493f1996645260320e90))
* **docs-site:** rebuild landing page with features, quickstart, and Cubicube CTA ([3a123cc](https://github.com/Nexartis/homeport-sdk/commit/3a123ccd860bccc0d5a55a9b02f65739fc979091))
* **docs-site:** switch docs domain to nnn-sdk.nexartis.com ([1a076d1](https://github.com/Nexartis/homeport-sdk/commit/1a076d10ac1cf0d75a828f32526b3ad948689799))
* **docs-site:** switch docs domain to nnn-sdk.nexartis.com ([2cd78d9](https://github.com/Nexartis/homeport-sdk/commit/2cd78d9092586bbf08236aba0271f08ab50ad290))
* **docs-site:** world-class landing page with features, quickstart, and Cubicube CTA ([aef9606](https://github.com/Nexartis/homeport-sdk/commit/aef96067e101352f3d72e86bb8508df3ea346696))
* implement NANDA SDK roadmap phases 0-3 ([b5e0103](https://github.com/Nexartis/homeport-sdk/commit/b5e01033423b298c36b7d8c9d4b7258261702934))
* implement SDK hardening sprints 1-4 — 33 new methods, 144 tests ([76c67de](https://github.com/Nexartis/homeport-sdk/commit/76c67dea71f6f80ecd53f117c94cb5a39ba6c1a8))
* **nanda-sdk:** implement phases 0-3 of NANDA SDK roadmap ([a9e9856](https://github.com/Nexartis/homeport-sdk/commit/a9e9856fa6f20b49a6d5e2db7381fc17ede8ba02))
* open-source prep — Apache-2.0, trusted-publish, TypeDoc site, workers example (v1.1.0) ([164803e](https://github.com/Nexartis/homeport-sdk/commit/164803e0d476a19a03b7ffb6bee6b158542b8159))
* **orchestration:** Voice-First 1.0 T1 — delegation grant/revoke/check SDK methods ([0072244](https://github.com/Nexartis/homeport-sdk/commit/0072244827a454eb07c7e7ba8734e3888b8529d7))
* rebrand to @nexartis/homeport-sdk 1.0.0 — the Homeport SDK ([5e4e95f](https://github.com/Nexartis/homeport-sdk/commit/5e4e95f0d602fa52285e898a039bff4bbe9c3c64))
* **SQUIRCLE:** initial @nexartis/nexartis-nanda-node-sdk implementation ([e38e7c6](https://github.com/Nexartis/homeport-sdk/commit/e38e7c60fcdaba8483e32cf1e938c30ba526145b))
* **SQUIRCLE:** Introducing @nexartis/nexartis-nanda-node-sdk v1.0.0 ([261ab6a](https://github.com/Nexartis/homeport-sdk/commit/261ab6ae06636d67be532f7046b8a42bd0bfa37b))
* tag-from-dev publish path for Homeport SDK 1.1.0 ([ea08a57](https://github.com/Nexartis/homeport-sdk/commit/ea08a575c30cbd59b4d4fc8bdf67d31e6719ffb7))
* tag-from-dev publish path for Homeport SDK 1.1.0 ([1024779](https://github.com/Nexartis/homeport-sdk/commit/10247795084ab81a85fecd3fd3efb6a19d477d80))
* visibility lifecycle, capability/MCP/pricing metadata, and trust-badge contracts ([e24518e](https://github.com/Nexartis/homeport-sdk/commit/e24518e4c8e4886dab912ddd8e07c19031392c95))
* visibility lifecycle, capability/MCP/pricing metadata, and trust-badge contracts (Set C) ([8b3f6ed](https://github.com/Nexartis/homeport-sdk/commit/8b3f6ed2f18696858031b29ec7595ccdd354bf06))
* Voice-First 1.0 T1 delivery and docs consolidation ([34d5d85](https://github.com/Nexartis/homeport-sdk/commit/34d5d85740f2e401e7f2c03a1de8837dfcbdc22a))
* Voice-First 1.0 T1 delivery and docs consolidation ([#42](https://github.com/Nexartis/homeport-sdk/issues/42)) ([b222bb4](https://github.com/Nexartis/homeport-sdk/commit/b222bb40728d074f50919e25cc53b3f640b63f9a))
* Wave 2.4 compose Homeport A2A from authority-grant/1 ([1f26f30](https://github.com/Nexartis/homeport-sdk/commit/1f26f30c2f58b4ecd74d4a0f9eb14c1f16df8ac1))


### Bug Fixes

* address all PR [#5](https://github.com/Nexartis/homeport-sdk/issues/5) review comments ([3535270](https://github.com/Nexartis/homeport-sdk/commit/353527050861a225c12c5fb982aac192d82b8b58))
* address all review comments — tuple array headers, retry clone optimization, example/test alignment ([f1a10ac](https://github.com/Nexartis/homeport-sdk/commit/f1a10ac097e5bf63ba103849de397d8c67c6ce3d))
* address Augment review — credential leakage, crypto safety, pagination, callback errors ([62059b1](https://github.com/Nexartis/homeport-sdk/commit/62059b148f30d768f97a76182796a568434badc9))
* address latest augment review (4 issues) ([b0d8eb8](https://github.com/Nexartis/homeport-sdk/commit/b0d8eb83f366c89325f4edd7a9c12ec0fd35782c))
* address review — centralize error handling in fetch(), fix pagination normalization, discriminated union for IndexChangeEvent ([74026c8](https://github.com/Nexartis/homeport-sdk/commit/74026c8280c6e3a0c1c8a234c5da1a6b8db3769a))
* address review round 2 — skipBreaker for A2A calls, safeParseJson, CHANGELOG accuracy, afterResponse doc clarification ([5de21b6](https://github.com/Nexartis/homeport-sdk/commit/5de21b6b82c767e3d41eeaae4aa63c3ceea2299b))
* address round-2 review — async callback safety, SSE stream cleanup ([12d8c0d](https://github.com/Nexartis/homeport-sdk/commit/12d8c0d28ce526374f2fc272160a7ee14ce9863d))
* align docs Node engine with Vite ([0bffc25](https://github.com/Nexartis/homeport-sdk/commit/0bffc25d17351711104d1222404c12f4f57095b8))
* align docs Node engine with Vite ([b5051a4](https://github.com/Nexartis/homeport-sdk/commit/b5051a491c1fb80b2e6ba929c5717479976b3cf7))
* align SDK paths with backend routes ([65d18ee](https://github.com/Nexartis/homeport-sdk/commit/65d18eee4b6783fd8d754421bac08f94ef3ef94a))
* **audit:** use mockImplementation in client.test.ts for fresh Response per call ([16e818b](https://github.com/Nexartis/homeport-sdk/commit/16e818ba3bf5c5d441c19eccb3f4241658f69de5))
* **ci:** add npm-publish environment to publish job for OIDC trusted publishing ([817575a](https://github.com/Nexartis/homeport-sdk/commit/817575a32ce36831c722029f21a4e04a2807d2da))
* **ci:** add npm-publish environment to publish job for OIDC trusted publishing ([f541c26](https://github.com/Nexartis/homeport-sdk/commit/f541c2643dfa9509cb8215b7e5a26d123567d2ea))
* **ci:** make publish size-limit step non-blocking + include preset ([34ebe84](https://github.com/Nexartis/homeport-sdk/commit/34ebe84d9c53b074a4e341087c9575710eff6d52))
* **ci:** publish via NPM_TOKEN to unblock v1.2.0 release ([ea8ec21](https://github.com/Nexartis/homeport-sdk/commit/ea8ec21837a1b034256b645ac55a15201b4b8e30))
* circuit breaker isolation, hook observability, discriminated union events ([cb62bdd](https://github.com/Nexartis/homeport-sdk/commit/cb62bdd35986d907783c84714b1b9a0b7c68c7c5))
* **ci:** switch publish to 'npm publish' (not 'pnpm publish') for OIDC ([f162e4e](https://github.com/Nexartis/homeport-sdk/commit/f162e4edc8aab7cb60be2daa7b408fc533b15952))
* **ci:** switch to 'npm publish' for OIDC Trusted Publishing (with NPM_TOKEN fallback) ([08fdc4a](https://github.com/Nexartis/homeport-sdk/commit/08fdc4a37b34c6241aa2ab8b2b1b5b937cabee0e))
* **ci:** unblock publish to npmjs — size-limit preset + non-blocking ([45bc90e](https://github.com/Nexartis/homeport-sdk/commit/45bc90e01dda802ea9becb2c449f45a20769769c))
* clone lastResponse for afterResponse hook, exclude 429 from circuit breaker, refactor retry test ([f5d5c1e](https://github.com/Nexartis/homeport-sdk/commit/f5d5c1e9e8f436b9947ca404fc403f3613fab187))
* correct SDK_VERSION comment (not derived at build time) ([7f087d1](https://github.com/Nexartis/homeport-sdk/commit/7f087d128ba4ab26b510c787ed5f09c99c93cf6d))
* **deps:** close Dependabot advisories via selector overrides ([a9f87a1](https://github.com/Nexartis/homeport-sdk/commit/a9f87a1b4e54da1e84f57e74093471aa70d41ac3))
* **docs-site:** lock playwright/vitest deps, exact tab locators in e2e, ignore test artifacts ([7f0e825](https://github.com/Nexartis/homeport-sdk/commit/7f0e825ba339d52abdb15004b09700c65f1fa8df))
* **docs-site:** resolve axe violations on landing ([3fb65de](https://github.com/Nexartis/homeport-sdk/commit/3fb65dea2182b2252599a3b2144cbf1189c142f9))
* **docs:** grant.delegationId; npm 11; retag v1.2.0 ([76ad56d](https://github.com/Nexartis/homeport-sdk/commit/76ad56d8c2bdc3593f578d285ae05d0487e28613))
* **docs:** grant.delegationId; npm 11; retag v1.2.0 ([2d1f678](https://github.com/Nexartis/homeport-sdk/commit/2d1f678d252b4e8edd54b4fd135007b527831447))
* fetchWithRetry returns 5xx/429 responses for hook consistency + multi-line SSE parser ([826ced5](https://github.com/Nexartis/homeport-sdk/commit/826ced5626b1d1b590a3fad1c8a1e913643addc3))
* guard maxEndpoints/maxEntries boundary values & pass requestUrl consistently ([9193692](https://github.com/Nexartis/homeport-sdk/commit/9193692e23992f94ef11610bc79f055f8390b485))
* harden circuit breaker, hook safety, retry contract ([b26d3fe](https://github.com/Nexartis/homeport-sdk/commit/b26d3fef02c5901d19043fd2df3daeff0b68a541))
* harden isStreamingRequest detection, document SSE afterResponse exemption, replace expect.unreachable ([1919f73](https://github.com/Nexartis/homeport-sdk/commit/1919f73a7552336a5ae3a9a4837ac6c82cf6799b))
* holistic audit — fix NnnErrorCode.UNKNOWN, use safeParseJson consistently in syncCrossRegistryTrust and sendA2ARequest ([dc91058](https://github.com/Nexartis/homeport-sdk/commit/dc91058f5c803ff598a3320a3a21e539e4237507))
* improve logging for silent catch blocks in SSE streams and retry ([39500c8](https://github.com/Nexartis/homeport-sdk/commit/39500c8b01c79504020f3fff0d1bbb2f4a2e33b4))
* install typedoc-site before test:e2e ([c523dfd](https://github.com/Nexartis/homeport-sdk/commit/c523dfd3ca8088e3fbc1c717c2f145023278aa18))
* make currentStateFor() non-mutating for diagnostics ([2a69968](https://github.com/Nexartis/homeport-sdk/commit/2a69968561dd3999cc633f43e60cedb144f7ce4a))
* NaN-guard maxEndpoints, maxEntries, groupingDepth + shared-prefix test ([37f0941](https://github.com/Nexartis/homeport-sdk/commit/37f09417befdf9941e573f3b827dc426e1d191f3))
* **orchestration:** require PUH proof on delegation.grant ([a8ce251](https://github.com/Nexartis/homeport-sdk/commit/a8ce251a97c2a94db6e478c0380b6d83b82b6084))
* **orchestration:** require PUH proof on delegation.grant ([2aea4e0](https://github.com/Nexartis/homeport-sdk/commit/2aea4e02c397e98e0726997ffd4bc52648c8f535))
* pagination stagnation guard in searchAgentsAll/listAgentsAll — break if cursor doesn't advance ([c8ca0a3](https://github.com/Nexartis/homeport-sdk/commit/c8ca0a396f4c610590cad375f7c520859b63a585))
* per-endpoint circuit breaker grouping + ResponseCache LRU eviction ([187228b](https://github.com/Nexartis/homeport-sdk/commit/187228bdd27c1262591cf940c3ab472aca6995c6))
* per-endpoint circuit breaker grouping + ResponseCache LRU eviction ([5cd9b3e](https://github.com/Nexartis/homeport-sdk/commit/5cd9b3e64e41d7d9bbfd4a745c517819fdc2c4b1))
* **publish:** drop empty NPM_TOKEN so OIDC is not shadowed ([86964e9](https://github.com/Nexartis/homeport-sdk/commit/86964e93b6254cfa9fed47137b4d97670d308d5b))
* recordSuccess for streaming, afterResponse for retried-out 5xx/429, attach lastResponse to NnnError ([f0e0020](https://github.com/Nexartis/homeport-sdk/commit/f0e002021aa93a1418d04de8cb4543ee6d2069fc))
* regenerate SDK_VERSION to 1.2.1 ([093275f](https://github.com/Nexartis/homeport-sdk/commit/093275f25b7837d7d3196cee62fcf8ff0c3ff915))
* regenerate SDK_VERSION to 1.2.1 ([3021a23](https://github.com/Nexartis/homeport-sdk/commit/3021a23237ff60e94c9380a58db63aa6017029e9))
* regenerate SDK_VERSION to 1.2.2 ([a449baf](https://github.com/Nexartis/homeport-sdk/commit/a449baf695496bf75b68204984ee6a372ad927c6))
* release-please bumps SDK_VERSION with package.json ([6d531e5](https://github.com/Nexartis/homeport-sdk/commit/6d531e56abf2acc485b0175d1db2321a52fdb4e7))
* **RELEASE:** address SDK release review findings ([dad82d1](https://github.com/Nexartis/homeport-sdk/commit/dad82d121ba50a0858e4654d3a6103f420f81983))
* **RELEASE:** address SDK release review findings ([2874a01](https://github.com/Nexartis/homeport-sdk/commit/2874a0165d08af1365b9391639cc08d536e89829))
* **release:** make docs E2E self-contained ([5b1caa2](https://github.com/Nexartis/homeport-sdk/commit/5b1caa26a4d11a56a94c567e99140c077d34debd))
* **review:** address code review feedback ([8b1c9d3](https://github.com/Nexartis/homeport-sdk/commit/8b1c9d3a980a6c22a642bb1a1a2f429e828fbe2e))
* **review:** sdk[#47](https://github.com/Nexartis/homeport-sdk/issues/47) triage — docs domain, example dep to ^1.0.0, redirect-worker dev env flag ([4c7ce68](https://github.com/Nexartis/homeport-sdk/commit/4c7ce68a93a3a67b972628bcad338f5ed8b74175))
* robust SSE parser (data: prefix flexibility) + clone Response for afterResponse hooks ([320e294](https://github.com/Nexartis/homeport-sdk/commit/320e29412c547f470d2f32191585be2e8b2af86f))
* **security:** resolve CodeQL ReDoS alerts and drop duplicate codeql workflow ([f2475b7](https://github.com/Nexartis/homeport-sdk/commit/f2475b7b328d86ae6c7e07fa8add906505dfaa45))
* skip response.clone() for SSE streams to prevent unbounded buffering ([357646c](https://github.com/Nexartis/homeport-sdk/commit/357646cffa30fade1d18c8c5c8a453036edf71af))
* SSE [DONE] termination, example signature, lint-staged portability, README alignment ([762b02e](https://github.com/Nexartis/homeport-sdk/commit/762b02e2d2ef055aee9787c1fd33df9e4834a264))

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
