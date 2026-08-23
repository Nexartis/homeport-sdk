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
