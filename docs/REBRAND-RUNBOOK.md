# Homeport SDK Rebrand Runbook

> **Audience:** operators executing the `@nexartis/nexartis-nanda-node-sdk` → `@nexartis/homeport-sdk` rebrand. This checklist is written as **do not execute automatically**: every step below is a human-in-the-loop action, in order.

The rebrand ships as a single wave of PRs across `homeport` (main repo), this SDK, and its docs consumers. This runbook captures the operator-side steps that live outside the PR diff: GitHub rename, tag surgery, Cloudflare custom-domain rewiring, the publish gate, and the downstream doc update.

---

## (a) GitHub repository rename

Rename the repo on GitHub:

1. **Settings → General → Rename repository** on `Nexartis/nexartis-nanda-node-sdk` → new name **`homeport-sdk`**.
2. GitHub installs a permanent redirect from the old owner/name to the new one; existing PRs, issues, and clones continue to resolve.
3. Update local remotes on developer machines:

   ```bash
   git remote set-url origin git@github.com:Nexartis/homeport-sdk.git
   git remote -v   # verify
   ```

4. Confirm the rename lands cleanly by re-running the two release-critical workflows on `prod` after merge: `release-please.yml`, `publish.yml`.

## (b) Relocate legacy git tags v1.0.0–1.3.0 to a `legacy/*` namespace

The pre-rebrand tags collide with the fresh 1.0.0 Homeport release. Move them under `legacy/` locally, then push and delete the old refs on the remote:

```bash
# Fetch every tag first.
git fetch --tags

# Rename each tag locally to legacy/v<version>.
for v in 1.0.0 1.1.0 1.2.0 1.2.1 1.2.2 1.3.0; do
  if git rev-parse -q --verify "refs/tags/v$v" >/dev/null; then
    git tag "legacy/v$v" "v$v"
    git tag -d "v$v"
  fi
done

# Push the new legacy/* tags.
git push origin --tags

# Delete the old plain v* tags on the remote.
for v in 1.0.0 1.1.0 1.2.0 1.2.1 1.2.2 1.3.0; do
  git push origin ":refs/tags/v$v" || true
done
```

Then edit the associated GitHub Releases (`gh release list`) so their tag targets follow (`gh release edit v1.2.1 --tag legacy/v1.2.1`). Do **not** delete the releases — they document the historical `@nexartis/nexartis-nanda-node-sdk` line and are linked from `CHANGELOG.pre-homeport.md`.

## (c) Cloudflare custom-domain provisioning

Rewire the four hostnames in the Nexartis Cloudflare account:

1. **Provision new docs origins**
   - Add custom domain `homeport-sdk-dev.nexartis.com` bound to the `typedoc-site` Worker (`env.dev`).
   - Add custom domain `homeport-sdk.nexartis.com` bound to the `typedoc-site` Worker (`env.prod`).
2. **Rebind the legacy hostnames to the redirect worker**
   - Detach any existing custom-domain binding on `nnn-sdk-dev.nexartis.com` (previously bound to `typedoc-site` `env.dev`) if Cloudflare refuses to reassign it in-place.
   - Bind `nnn-sdk-dev.nexartis.com` to `homeport-sdk-legacy-redirect` (`env.dev`).
   - Repeat: detach `nnn-sdk.nexartis.com` from `typedoc-site` `env.prod`, then bind it to `homeport-sdk-legacy-redirect` (`env.prod`).
3. **Verify**

   ```bash
   curl -sI https://nnn-sdk.nexartis.com/           # expect 301 → https://homeport-sdk.nexartis.com/
   curl -sI https://homeport-sdk.nexartis.com/      # expect 200
   curl -sI https://homeport-sdk-dev.nexartis.com/  # expect 200
   ```

## (d) Publish gate

Before the first Homeport publish, run the workspace publish gate against a clean checkout:

```bash
pnpm install --frozen-lockfile
pnpm run validate
npm pack --dry-run                     # review file list
pnpm dlx publint
pnpm dlx @arethetypeswrong/cli --pack .
```

Also typecheck a consumer fixture that installs `@nexartis/homeport-sdk` from the tarball produced by `npm pack` and calls `HomeportClient`, `HomeportError`, `HomeportErrorCode`.

## (e) Publish Homeport from `dev` — do not merge onto nanda `prod`

**Current process:** `docs/PUBLISH.md`. The 1.1.0 cut is done
(`@nexartis/homeport-sdk@1.1.0` on npmjs, `gitHead=ea08a57`). Use that
file for the next release. The rest of this section is the 1.1.0
historical checklist.

`origin/dev` is `@nexartis/homeport-sdk`. `origin/prod` is still
`@nexartis/nexartis-nanda-node-sdk@1.3.0`. The two histories have **no
merge-base**. PR #49 (`dev`→`prod`) is closed and must stay closed —
merging would overwrite the nanda line.

`@nexartis/homeport-sdk@1.0.0` is already on npmjs (2026-07-18, pre-#50).
Ship the current `dev` surface as **1.1.0** from a tag on `dev`:

1. Merge the publish-path PR to `dev` (human). Full gate: `pnpm run validate`.
2. Cut the tag on the merged `dev` HEAD (do not reuse bare `v1.0.0`–`v1.3.0`; those are `legacy/*`):

   ```bash
   git checkout dev
   git pull --ff-only origin dev
   git tag v1.1.0
   git push origin v1.1.0
   ```

3. That tag push is the only `publish.yml` trigger. The job fails unless
   `package.json` name is `@nexartis/homeport-sdk` **and** the tag equals
   `v${version}` (so `v1.1.0` cannot publish a 1.2.0 tree). It then
   publishes and creates the GitHub Release for that tag.
4. Leave `release-please.yml` on nanda `prod` for this cut — retargeting
   it to `dev` before `v1.1.0` exists would open a competing 1.2.0
   release PR. After the tag is on `dev`, a follow-up PR may point
   release-please at `dev` for later Homeport minors.
5. Docs/redirect Workers still deploy from `prod` today
   (`deploy-docs.yml` / `deploy-redirect.yml`). Do not retarget those by
   merging Homeport onto nanda `prod`. After verify (f), dispatch
   `deploy-docs.yml` on a Homeport checkout (or a later dedicated
   docs-from-dev change) so `homeport-sdk.nexartis.com` matches 1.1.0.

## (f) Verify the npm publish

```bash
npm view @nexartis/homeport-sdk version        # expect: 1.1.0
npm view @nexartis/homeport-sdk@1.1.0 --json | jq '.dist, .repository, .homepage'
npm audit signatures --package @nexartis/homeport-sdk@1.1.0
```

Expected values: `homepage` = `https://homeport-sdk.nexartis.com`, `repository.url` → `github.com/Nexartis/homeport-sdk`, provenance attestation present.

## (g) Deprecate the predecessor package

Once 1.0.0 is verified on npm, deprecate the old package with a pointer message. Run **exactly** this command:

```bash
npm deprecate @nexartis/nexartis-nanda-node-sdk "This package has been republished as @nexartis/homeport-sdk. Please migrate: https://homeport-sdk.nexartis.com"
```

Do not `npm unpublish` — the historical versions remain installable for consumers pinning the old identifier, they just surface the deprecation notice at install time.

## (h) Update Homeport main-repo docs

Open a follow-up PR on `Nexartis/homeport` updating both surfaces to the new SDK identity:

- `README.md` — replace any `@nexartis/nexartis-nanda-node-sdk` reference with `@nexartis/homeport-sdk`; link to `https://homeport-sdk.nexartis.com`.
- The SDK section of the docs site (`docs/sdk.md` or equivalent) — update install snippets, symbol names (`HomeportClient`, `HomeportError`, `HomeportErrorCode`), env vars (`HOMEPORT_API_KEY`), and log prefix.

**Amend the existing PR #3** on `Nexartis/homeport` with these edits rather than opening a new PR (per the wave plan: one PR per repo per workstream).

---

## Rollback

If the npm publish fails or a downstream issue surfaces before deprecation is announced:

1. Do not `npm unpublish` — npm's 72-hour unpublish window is fragile and permanently disables the version on re-publish attempts.
2. Instead, publish a `1.0.1` patch with the fix and skip the deprecate step in (g) until the fix ships.
3. Legacy hostnames continue to redirect — the deprecation window is defined by the redirect-worker binding, not by the deprecate command.
