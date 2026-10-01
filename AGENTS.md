# AGENTS.md

Guidance for coding agents (and humans) working on Beans Editor. The product spec is in [docs/spec.md](docs/spec.md); read it before changing behaviour.

## What this is

A backend-free, offline-first PWA that edits [Beanconqueror](https://beanconqueror.com) backup zips. The backup is the only format that round-trips without data loss, so it's the only one supported; the bean Excel templates and the Excel export are deliberately out of scope. Everything runs in the browser; no file ever leaves the device.

## Commands

| Task                          | Command                                                           |
| ----------------------------- | ----------------------------------------------------------------- |
| Install                       | `corepack enable && yarn install` (Yarn 4, Node 24, see `.nvmrc`) |
| Dev server                    | `yarn dev` (no service worker in dev)                             |
| Everything CI runs except e2e | `yarn validate`                                                   |
| Types                         | `yarn check` (svelte-check + tsc for config and e2e)              |
| Lint + format check           | `yarn lint` (`yarn format` to fix)                                |
| Unit tests                    | `yarn test` (Vitest, `src/**/*.test.ts`)                          |
| E2E tests                     | `yarn test:e2e` (Playwright, builds and serves `dist/`)           |
| Initial JS budget             | `yarn size` (100 KB gzipped, after `yarn build`)                  |
| Deploy                        | `yarn deploy` (Wrangler to Cloudflare static assets)              |

Use Yarn 4 (via Corepack) only, never npm; `yarn.lock` is the lockfile and `.yarnrc.yml` uses the `node-modules` linker. If Corepack can't reach repo.yarnpkg.com, set `COREPACK_NPM_REGISTRY=https://registry.npmjs.org`.

If Chromium is preinstalled somewhere instead of via `yarn playwright install`, set `PW_CHROMIUM_PATH` to its executable.

## shadcn-svelte skill

Always install the shadcn-svelte skill before touching the UI: `npx skills add huntabyte/shadcn-svelte`. Build UI from its components (Toggle Group, Badge, and so on), copied into `src/lib/components/ui` on the project's own tokens.

## Definition of done

Every change must pass `yarn validate` and `yarn test:e2e` before it is pushed. Add or update tests with the change: unit tests for parsing, writing and state; e2e tests for user flows. Never skip, disable or loosen a test to get green.

## Versioning

Every PR must raise `version` in `package.json` above the base branch's; CI's `version` job fails otherwise. Bump it yourself in the PR, picking the [semantic version](https://semver.org) bump that matches what the PR introduces:

- **Major**: a breaking change for users, such as dropping a supported backup layout or changing how shared links or files are handled in an incompatible way.
- **Minor**: a new user-facing feature or capability that stays backwards compatible.
- **Patch**: bug fixes, refactors, dependency updates, docs, tests and CI changes with no new user-facing behaviour.

While the version is `0.x`, a breaking change bumps the minor version instead of the major. Bump once per PR, relative to the base branch, not once per commit.

## Architecture

- **Svelte 5 with runes** (`$state`, `$derived`, `$props`), TypeScript strict, Vite. No SvelteKit; one page.
- **Tailwind CSS 4** with design tokens in `src/app.css` (`bg`, `fg`, `surface`, `muted`, `border`, `accent`, `danger`). Use the tokens, not raw colours. Light/dark follow the system.
- **UI components**: Bits UI primitives (shadcn-svelte style, copied into `src/lib/components/ui` when needed), Lucide icons via `@lucide/svelte`.
- **i18n**: Paraglide. Every user-visible string lives in `messages/en.json` and is used as `m.key()` from `$paraglide/messages`. `src/lib/paraglide` is generated; don't edit or commit it. The inlang plugin is loaded from `node_modules`, so builds work offline.
- **Files**: `fflate` for zip. A file is judged by its contents (`readBackup` in `src/lib/formats/backup/backup.ts`), never by name or MIME type.
- **PWA**: `vite-plugin-pwa` in `injectManifest` mode. The service worker is `src/sw.ts`. It precaches the whole build and handles the Android `share_target` POST (`/share-target`). It stores a shared file in IndexedDB (`src/lib/share/inbox.ts`) and redirects to `/?shared-file=1`; a shared link redirects to `/?shared-link=…`, which opens the add-from-link dialog on it (`src/lib/components/AddFromLink.svelte`, `src/lib/beanlink`). The manifest is in `pwa.manifest.ts`. Updates are prompt-based (`src/lib/pwa/update.svelte.ts`); never auto-reload while the user edits.
- **Code splitting**: anything heavy (zip parsing, editors) is loaded with dynamic `import()` and rendered with `{#await}` plus a skeleton. The service worker still precaches lazy chunks, so offline keeps working.
- **Storage**: unsaved work goes in IndexedDB via `idb-keyval`, versioned and validated with Valibot on load. Invalid stored data is never silently dropped.
- **Hosting**: Cloudflare static assets (`wrangler.jsonc`). Security and cache headers are in `public/_headers`. Keep the CSP strict; add origins to `connect-src` only when a feature needs them.

## Conventions

- Keep modules used by the service worker DOM-free (`src/lib/share`, `src/lib/files`).
- Prefer small pure functions with unit tests over logic inside components.
- Accessibility: every control is keyboard reachable with a visible focus ring and an accessible name, and meets WCAG AA contrast.
- Don't add runtime dependencies without a reason. Check their size and whether they work in a worker.
- Never commit real user data. Test fixtures are synthetic or anonymized.

## Beanconqueror backup format

- **Backup zip**: `Beanconqueror.json` (`BEANS`, `BREWS`, `MILL`, `PREPARATION`, `SETTINGS`, `VERSION`, …) plus `Beanconqueror_Brews_N.json` chunks of 500 brews. Records have `config.uuid` and `config.unix_timestamp`. Preserve unknown keys when writing.
