# Dependency Overrides

All overrides live in `pnpm-workspace.yaml` (`overrides:`). Security overrides
use selector form (`'pkg@vulnerableRange': 'patched'`) so they rewrite only
vulnerable resolutions and become inert once every parent ships the fix.
Never add plain override keys to `package.json`.

| override | kind | fixes | exit condition |
| :--- | :--- | :--- | :--- |
| `'brace-expansion@>=3.0.0 <5.0.7': 5.0.7` | security (selector) | Dependabot brace-expansion advisory (>=3.0.0 <5.0.7); replaces plain `>=5.0.6` pin that resolved vulnerable 5.0.6 | delete when `pnpm audit` stays clean after removal |
| `'linkify-it@<=5.0.1': 5.0.2` | security (selector) | Dependabot linkify-it advisory (<=5.0.1) | delete when `pnpm audit` stays clean after removal |
| `'postcss@<=8.5.22': 8.5.23` | security (selector) | Dependabot postcss advisories (<=8.5.17, <=8.5.22) | delete when `pnpm audit` stays clean after removal |
| `'sharp@<0.35.0': 0.35.0` | security (selector) | Dependabot sharp advisory (<0.35.0) | delete when `pnpm audit` stays clean after removal |
| `'undici@>=7.0.0 <7.29.0': 7.29.0` | security (selector) | Dependabot undici 7.x advisory (>=7.0.0 <7.29.0) | delete when `pnpm audit` stays clean after removal |
| `esbuild: 0.28.1` | graph alignment (migrated from package.json) | keeps single esbuild instance aligned with vite toolchain | bump together with the vite toolchain |
| `markdown-it: '>=14.2.0'` | legacy security (migrated from package.json) | historical markdown-it advisory | convert to selector or delete once parents require patched range natively |
| `picomatch: '>=4.0.4'` | legacy security (migrated from package.json) | historical picomatch advisory | convert to selector or delete once parents require patched range natively |
| `vite: 8.0.16` | graph alignment (migrated from package.json) | single-instance vite dedupe aligned with direct devDependency | bump together with the direct `vite` devDependency |

Packages pinned by security selectors are listed in `minimumReleaseAgeExclude`
so the 7-day supply-chain quarantine (`minimumReleaseAge: 10080`) never blocks
an active security patch. `@nexartis/*` is always excluded (first-party
publishes from our own CI).

## typedoc-site (standalone project — exception)

`typedoc-site/` is a STANDALONE pnpm project (own `pnpm-lock.yaml`, installed
with `pnpm install --ignore-workspace`; a plain `pnpm install` inside it walks
up and silently installs the ROOT project instead — measured 2026-09-10). Root
`pnpm-workspace.yaml` overrides therefore never reach it, and its selector
overrides live in `typedoc-site/package.json` `pnpm.overrides` — the only
config surface a standalone project has. Selector form and every other rule
above still bind.

| override | kind | fixes | exit condition |
| :--- | :--- | :--- | :--- |
| `'sharp@<0.35.4': 0.35.4` | security (selector) | Dependabot sharp advisories (<0.35.0, <0.35.4 — 2 high) on typedoc-site/pnpm-lock.yaml | delete when `pnpm audit` stays clean after removal |
| `'undici@>=7.0.0 <7.29.0': 7.29.0` | security (selector) | Dependabot undici 7.x advisory (1 high + mediums) | delete when `pnpm audit` stays clean after removal |
| `'postcss@<=8.5.22': 8.5.23` | security (selector) | Dependabot postcss advisory (<=8.5.22) | delete when `pnpm audit` stays clean after removal |
| `'nanoid@<3.3.18': 3.3.18` | security (selector) | nanoid 3.3.16 high (transitive via postcss), surfaced by the isolated typedoc-site audit 2026-09-10 | delete when `pnpm audit` stays clean after removal |

Audit result after this block: 9 vulnerabilities (4 high, 5 moderate) → 0
(isolated-lockfile audit; tests 6/6 vitest + 3/3 playwright + frozen install
exit 0). **Named root-side residual (NOT covered by the 8 GitHub alerts, own
red/green required):** root lockfile carries `vitest@4.1.10` (GHSA-82fw-gwwq-j7x9
patched ≥4.1.11) and root override `'sharp@<0.35.0': 0.35.0` sits below the
0.35.4 patch line — next root one-PR candidate.
