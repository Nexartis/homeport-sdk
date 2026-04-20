# Project Governance

The Nexartis NANDA Node SDK is stewarded by Nexartis, LLC and developed in
the open under the Apache License, Version 2.0. This document describes how
decisions are made, how contributors earn additional responsibilities, and
how substantial changes are reviewed.

## Maintainer tiers

There are three tiers of contributor responsibility. Movement between tiers
is earned through sustained, high-quality contribution — not tenure.

### Triager

Contributors who help keep the issue tracker and PR queue healthy.

**Responsibilities:**

- Reproduce reported bugs, apply labels, and move actionable issues forward.
- Answer or redirect support questions toward Discussions.
- Perform first-pass review on PRs (style, tests present, DCO signed).

**Criteria to become a Triager:**

- At least **3 merged PRs** within the past 6 months, or demonstrably
  equivalent contribution via issue triage and review comments.
- Familiarity with the SDK's public API surface.
- Nominated by an existing Maintainer and confirmed via lazy consensus
  (see below).

### Committer

Contributors trusted to merge PRs that fall within clear, well-understood
areas of the codebase.

**Responsibilities:**

- Review and merge PRs that do not introduce breaking changes to the public
  API.
- Uphold code quality, test coverage, and documentation standards.
- Escalate contentious or architectural changes to the Maintainers.

**Criteria to become a Committer:**

- At least **10 merged PRs** of non-trivial scope.
- Consistent track record of high-quality review feedback.
- Demonstrated understanding of the release process, semver policy, and the
  DCO workflow.
- Nominated by a Maintainer; confirmed via lazy consensus with no objection
  from any existing Committer or Maintainer.

### Maintainer

Contributors responsible for the long-term direction, release cadence, and
stewardship of the project.

**Responsibilities:**

- Approve RFCs for breaking changes and cross-cutting architectural work.
- Cut releases, manage the changelog, and sign off on security advisories.
- Grant and revoke Triager and Committer privileges.
- Represent the project in cross-organization discussions (Project NANDA,
  downstream consumers, standards bodies).

**Criteria to become a Maintainer:**

- Sustained contribution as a Committer for at least **6 months**.
- Demonstrated judgment on architectural trade-offs and API design.
- Willingness to take on release duties and respond to security reports.
- Nominated by an existing Maintainer; confirmed via lazy consensus with
  explicit approval from at least one other Maintainer.

## Decision process — lazy consensus

Day-to-day decisions follow **lazy consensus**: a proposal is considered
approved if no objection is raised within a **72-hour quiet period** after
it is posted to the relevant channel (PR, issue, or RFC). This keeps the
project moving without requiring formal votes for routine work.

- Objections must be substantive (technical, legal, or policy-based) and
  should propose a path to resolution.
- If an objection cannot be resolved through discussion, a Maintainer makes
  the final call. Maintainer decisions can be appealed in a subsequent RFC.
- Non-controversial fixes (documentation, typos, dependency bumps that pass
  CI) do not require a 72-hour wait.

## RFC process for breaking changes

Any change that meets one of the following bars requires an RFC:

- Removes or renames a public export from `src/index.ts` or any published
  submodule.
- Changes the signature or semantics of a public method in a way that is
  not backward compatible.
- Introduces a new runtime dependency under `src/core/**`.
- Changes the supported runtime matrix (Node, Bun, Deno, Workers, browser).
- Alters the SDK's security posture (auth flow, transport defaults, error
  disclosure).

**RFC workflow:**

1. Open an issue titled `RFC: <short description>` using the issue template.
2. Include: motivation, proposed API, alternatives considered, migration
   plan, and impact on downstream consumers.
3. Announce the RFC in GitHub Discussions for visibility.
4. Minimum open period: **14 days** to allow community and downstream input.
5. A Maintainer summarizes the discussion and either approves, requests
   changes, or rejects the RFC. Approval requires at least one Maintainer
   +1 and no unresolved Maintainer objections (lazy consensus applies).
6. Implementation PR references the RFC issue; the PR is merged under the
   standard review process.

RFCs are archived in the issue tracker with the `rfc` label. Accepted RFCs
that result in shipped changes are linked from the CHANGELOG entry for the
release in which they ship.

## Changing this document

Changes to `GOVERNANCE.md` itself follow the RFC process and require
approval from at least two Maintainers.
