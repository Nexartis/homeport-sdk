# Security Policy

The Homeport SDK is used in production systems that route agent traffic,
broker payments, and maintain trust metadata. Vulnerabilities are taken
seriously. Please follow this policy when reporting them.

## Reporting a vulnerability

Email `security@nexartis.com` with:

- A description of the issue and its impact.
- A minimal reproduction (code, request payload, or steps).
- The SDK version (`@nexartis/homeport-sdk` version from `package.json` or
  `pnpm why`) and runtime (Node, Workers, Bun, Deno, browser).
- Your preferred contact info for follow-up.

If the report contains sensitive details, request our PGP public key in the
initial email and we will respond with a key fingerprint and encrypted
channel.

**Do not** open a public GitHub issue, discussion, or pull request for
suspected vulnerabilities. GitHub Private Vulnerability Reporting is also
enabled on the repository and is an acceptable alternative channel.

## Coordinated disclosure

We follow a **90-day coordinated disclosure SLA** from the date a report is
acknowledged by a maintainer:

| Milestone | Target |
|---|---|
| Initial acknowledgement | Within **3 business days** of receipt |
| Triage and severity assessment | Within **10 business days** |
| Fix, advisory draft, release plan | Within **45 days** for High/Critical |
| Public disclosure + advisory | By **day 90**, or sooner once a fix ships |

If a report is already being actively exploited, we may accelerate
disclosure. Reporters are credited in the published advisory unless they
request anonymity.

## Supported versions

Security fixes are backported to the supported release lines listed below.

| Version | Supported |
|---|---|
| 1.x (current) | ✅ Yes |
| < 1.0 (pre-release) | ❌ No — upgrade to 1.x |

New major versions receive security fixes for at least 6 months after the
next major ships, giving consumers a window to migrate.

## Release provenance

Releases published to npmjs.com use **trusted publishing (OIDC)** from this
repository's GitHub Actions workflow and ship with **npm provenance
attestations**. Verify a release before installing:

```bash
npm view @nexartis/homeport-sdk@1.0.0 --json | jq .dist
npm audit signatures
```

The `provenance` field links to the exact GitHub Actions run that produced
the tarball. Any release missing provenance metadata should be treated as
unverified and reported to `security@nexartis.com`.

## Scope

In scope:

- Code in this repository (`src/**`, build outputs published to npm).
- Packaging integrity (provenance, tarball contents, install scripts).

Out of scope:

- Vulnerabilities in third-party services the SDK communicates with (report
  those to the service operator).
- Denial of service from unrealistic traffic levels against public endpoints.
- Issues that require physical or privileged local access to a developer's
  machine.

## Safe harbor

We will not pursue legal action against researchers who:

- Act in good faith and avoid privacy violations, data destruction, or
  service disruption.
- Give us a reasonable window to remediate before public disclosure.
- Do not exploit the vulnerability beyond what is necessary to demonstrate
  impact.
