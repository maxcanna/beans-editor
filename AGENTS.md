# AGENTS.md

Guidance for coding agents (and humans) working on Bean Editor. The product spec is in [docs/spec.md](docs/spec.md); read it before changing behaviour.

## What this is

A backend-free, offline-first PWA that creates and edits the files [Beanconqueror](https://beanconqueror.com) imports and exports: the backup zip, the roasted and green bean Excel templates, and the Excel export. Everything runs in the browser; no file ever leaves the device.

## Commands

| Task                          | Command                                                    |
| ----------------------------- | ---------------------------------------------------------- |
| Install                       | `npm ci` (Node 22, see `.nvmrc`)                           |
| Dev server                    | `npm run dev` (no service worker in dev)                   |
| Everything CI runs except e2e | `npm run validate`                                         |
| Types                         | `npm run check` (svelte-check + tsc for config and e2e)    |
| Lint + format check           | `npm run lint` (`npm run format` to fix)                   |
| Unit tests                    | `npm test` (Vitest, `src/**/*.test.ts`)                    |
| E2E tests                     | `npm run test:e2e` (Playwright, builds and serves `dist/`) |
| Initial JS budget             | `npm run size` (100 KB gzipped, after `npm run build`)     |
| Deploy                        | `npm run deploy` (Wrangler to Cloudflare static assets)    |

If Chromium is preinstalled somewhere instead of via `npx playwright install`, set `PW_CHROMIUM_PATH` to its executable.

## Definition of done

Every change must pass `npm run validate` and `npm run test:e2e` before it is pushed. Add or update tests with the change: unit tests for parsing, writing and state; e2e tests for user flows. Never skip, disable or loosen a test to get green.

## Architecture

- **Svelte 5 with runes** (`$state`, `$derived`, `$props`), TypeScript strict, Vite. No SvelteKit; one page.
- **Tailwind CSS 4** with design tokens in `src/app.css` (`bg`, `fg`, `surface`, `muted`, `border`, `accent`, `danger`). Use the tokens, not raw colours. Light/dark follow the system.
- **UI components**: Bits UI primitives (shadcn-svelte style, copied into `src/lib/components/ui` when needed), Lucide icons via `@lucide/svelte`.
- **i18n**: Paraglide. Every user-visible string lives in `messages/en.json` and is used as `m.key()` from `$paraglide/messages`. `src/lib/paraglide` is generated; don't edit or commit it. The inlang plugin is loaded from `node_modules`, so builds work offline.
- **Files**: `fflate` for zip. Detection is content-based (`src/lib/files/detect.ts`), never by name or MIME type.
- **PWA**: `vite-plugin-pwa` in `injectManifest` mode. The service worker is `src/sw.ts`. It precaches the whole build and handles the Android `share_target` POST (`/share-target`). It stores the file in IndexedDB (`src/lib/share/inbox.ts`) and redirects to `/?shared-file=1`. The manifest is in `pwa.manifest.ts`. Updates are prompt-based (`src/lib/pwa/update.svelte.ts`); never auto-reload while the user edits.
- **Code splitting**: anything heavy (parsers, writers, editors, bundled templates) is loaded with dynamic `import()` and rendered with `{#await}` plus a skeleton. The service worker still precaches lazy chunks, so offline keeps working.
- **Storage**: unsaved work goes in IndexedDB via `idb-keyval`, versioned and validated with Valibot on load. Invalid stored data is never silently dropped.
- **Hosting**: Cloudflare static assets (`wrangler.jsonc`). Security and cache headers are in `public/_headers`. Keep the CSP strict; add origins to `connect-src` only when a feature needs them.

## Conventions

- Keep modules used by the service worker DOM-free (`src/lib/share`, `src/lib/files`).
- Prefer small pure functions with unit tests over logic inside components.
- Accessibility: every control is keyboard reachable with a visible focus ring and an accessible name, and meets WCAG AA contrast.
- Don't add runtime dependencies without a reason. Check their size and whether they work in a worker.
- Never commit real user data. Test fixtures are synthetic or anonymized.

## Beanconqueror formats (summary)

- **Backup zip**: `Beanconqueror.json` (`BEANS`, `BREWS`, `MILL`, `PREPARATION`, `SETTINGS`, `VERSION`, …) plus `Beanconqueror_Brews_N.json` chunks of 500 brews. Records have `config.uuid` and `config.unix_timestamp`. Preserve unknown keys when writing.
- **Roasted/green templates**: sheets `Readme_and_Consistency_Check`, `Beans` or `Green Beans`, and `Bean_Information` (enum lists behind the dropdown validations). Only the first origin columns (`1. Country` …) exist.
- **Excel export**: sheets `Brews`, `Beans`, `Methods`, `Grinders`. Beanconqueror can re-import its `Beans` sheet via "Import roasted beans via Excel table".
