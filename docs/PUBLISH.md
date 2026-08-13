# Homeport SDK publish runbook

Canonical process for shipping `@nexartis/homeport-sdk` after the 1.1.0
cut. Rebrand one-shot steps (repo rename, `legacy/*` tags) stay in
`docs/REBRAND-RUNBOOK.md`. This file is what you run next time.

**Never merge `dev` onto nanda `prod`.** Those histories have no
merge-base. `origin/prod` is still `@nexartis/nexartis-nanda-node-sdk`
1.3.0. PR #49 stays closed.

## Identity

| ref | package | how it ships |
| --- | --- | --- |
| `origin/dev` | `@nexartis/homeport-sdk` | `v*.*.*` tag on `dev` whose name equals `v${package.json version}` |
| `origin/prod` | `@nexartis/nexartis-nanda-node-sdk` | separate nanda maintenance path — do not use `publish.yml` |

`publish.yml` fails unless the tree’s `package.json` name is
`@nexartis/homeport-sdk` **and** `GITHUB_REF_NAME == v${version}`.
`workflow_dispatch` and `prod` pushes are not publish triggers.

Do not reuse bare `v1.0.0`–`v1.3.0`. Those are `legacy/*` (nanda line).

## Preferred path — GitHub Actions + Trusted Publisher

1. Land one PR to `dev`. Full gate: `pnpm run validate`. Human merges.
2. Tag the **merged** `dev` HEAD (not the feature-branch tip if GitHub
   made a merge commit):

   ```bash
   git fetch origin dev --tags
   git checkout dev
   git pull --ff-only origin dev
   git tag -a vX.Y.Z -m "Homeport SDK X.Y.Z"
   git push origin vX.Y.Z
   ```

3. That tag is the only `publish.yml` trigger. Watch the run. On
   success it publishes with `--provenance` and creates the GitHub
   Release.

4. Verify:

   ```bash
   npm view @nexartis/homeport-sdk version
   npm view @nexartis/homeport-sdk@X.Y.Z --json
   gh release view vX.Y.Z --repo Nexartis/homeport-sdk
   ```

### Trusted Publisher (required for CI)

npmjs → `@nexartis/homeport-sdk` → **Publishing access** → Trusted
Publisher:

- Repository: `Nexartis/homeport-sdk`
- Workflow filename: `publish.yml`
- Environment: **none** (the job has no `environment:`)

Without this, the job reaches `npm publish --provenance` and fails
`ENEEDAUTH`.

Do **not** keep a stale `NPM_TOKEN` repo secret. `setup-node` writes
`NODE_AUTH_TOKEN` into `NPM_CONFIG_USERCONFIG`; a dead token shadows
OIDC and npm returns **404** on the publish PUT (observed 2026-08-13
on run `31675079695`). Delete the secret unless it is a current
Automation token that can publish this package.

`release-please.yml` still targets nanda `prod`. Do not retarget it to
`dev` until a Homeport `v*.*.*` tag already exists on `dev` (otherwise
it opens a competing next-minor PR that races the hand tag).

## Fallback path — local web session (used for 1.1.0)

Use when Trusted Publisher is not configured yet. Local `npm publish`
cannot sign OIDC provenance (`publishConfig.provenance: true` fails
without `--provenance=false`). Restore provenance on the next CI
release after Trusted Publisher is set.

Classic tokens were revoked 2025-12-09. `npm login` now mints a
**two-hour session** (not a long-lived token). Publishing still
requires 2FA. `npm publish --auth-type=web` opens the browser and can
offer **“remember me for 5 minutes”** so a follow-up publish from the
same IP + session skips the OTP prompt.

In a real terminal (interactive — agents cannot complete the browser
step):

```bash
cd /path/to/nexartis-nanda-node-sdk
git fetch origin dev --tags
git checkout dev
git pull --ff-only origin dev
# HEAD must be the tagged commit
git rev-parse HEAD
git rev-parse vX.Y.Z^{}

npm login --auth-type=web --registry=https://registry.npmjs.org
npm whoami --registry=https://registry.npmjs.org

pnpm run validate
npm pack --dry-run

npm publish --auth-type=web --provenance=false --access public
```

If you omit `--auth-type=web` on publish, npm returns `EOTP` and
requires `--otp=<code>`. Do not paste OTPs into agent chat.

Then create the GitHub Release if CI did not:

```bash
gh release create vX.Y.Z --repo Nexartis/homeport-sdk \
  --title "vX.Y.Z" --target "$(git rev-parse HEAD)" \
  --generate-notes --verify-tag
```

## Docs site

`deploy-docs.yml` / `deploy-redirect.yml` still fire on `prod` (nanda
tree). After a Homeport publish, dispatch docs from the tag:

```bash
gh workflow run deploy-docs.yml --repo Nexartis/homeport-sdk --ref vX.Y.Z
curl -sI https://homeport-sdk.nexartis.com/
```

## 1.1.0 record (2026-08-13)

- PR: https://github.com/Nexartis/homeport-sdk/pull/51 (merged `ea08a57`)
- Tag: `v1.1.0` → `ea08a57`
- Release: https://github.com/Nexartis/homeport-sdk/releases/tag/v1.1.0
- CI publish run `31675079695`: guard/tests green; first attempt 404
  (stale `NPM_TOKEN`); second attempt `ENEEDAUTH` (no Trusted Publisher)
- Local publish: `npm publish --auth-type=web --provenance=false`
  as `tony-nexartis` at 2026-08-13T07:01:35Z
- npmjs: `@nexartis/homeport-sdk@1.1.0`, `gitHead=ea08a57`

## Do not

- Merge Homeport `dev` onto nanda `prod`
- Force-push `prod` or delete nanda 1.3.0 history
- Publish Homeport under `@nexartis/nexartis-nanda-node-sdk`
- Hand a long-lived npm token to an agent or commit it
- Re-cut `v1.0.0`–`v1.3.0` (legacy)
- `npm unpublish` a failed version — ship a new patch instead
