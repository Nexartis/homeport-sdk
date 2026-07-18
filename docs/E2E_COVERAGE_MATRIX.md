# Homeport SDK E2E Coverage Matrix

## Scope

This repo is primarily an SDK, but it includes a public TypeDoc site served by `typedoc-site/`. Browser end-to-end coverage therefore applies to the docs site, not to the SDK runtime package itself.

## Public journey matrix

| Journey | Current coverage | Status | Follow-up |
|---|---|---|---|
| Docs landing page loads at the dev docs URL. | Manual dev deploy validation only. | Missing automation | Add Playwright smoke test. |
| Visitor opens generated API reference from the landing page. | Manual validation only. | Missing automation | Add Playwright check for `/api/`. |
| Visitor switches install-command tabs. | Manual validation only. | Missing automation | Add resilient role/text locators. |
| Visitor copies install command. | Manual validation only. | Missing automation | Add browser clipboard-safe or event-level test. |
| Visitor navigates external npm/GitHub links. | Manual/link review only. | Missing automation | Consider lightweight link check. |

## Authenticated journey matrix

| Journey | Applicability | Notes |
|---|---|---|
| User login | Not applicable | The docs site has no authentication. |
| Authenticated account/admin journeys | Not applicable | The SDK package has no hosted admin UI. |

## Playwright resilience expectations

Future Playwright tests should use user-facing locators, avoid hard waits, collect traces/screenshots on failure, and avoid relying on production-only mutable state.
