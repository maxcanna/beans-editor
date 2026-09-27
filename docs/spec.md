# Bean Editor: spec v1

Repository: `maxcanna/bean-editor` (private). Hosting: Cloudflare (static assets, free tier).
A backend-free Progressive Web App (PWA) that creates and edits the files Beanconqueror imports and exports. Everything runs in the browser, and the app works fully offline after the first visit.

## 1. File formats

| Format                                                                                           | Read | Write     | Beanconqueror import path                                                 |
| ------------------------------------------------------------------------------------------------ | ---- | --------- | ------------------------------------------------------------------------- |
| Backup zip (`Beanconqueror.json` + `Beanconqueror_Brews_N.json`, brews split into chunks of 500) | ✓    | ✓         | Settings › Import                                                         |
| Roasted bean template (xlsx)                                                                     | ✓    | ✓         | Import roasted beans via Excel table                                      |
| Green bean template (xlsx)                                                                       | ✓    | ✓         | Import green beans via Excel table (needs the roasting section turned on) |
| Excel export (xlsx: Brews/Beans/Methods/Grinders)                                                | ✓    | ✓ (beans) | Import roasted beans via Excel table (beans only)                         |
| Full export to a folder                                                                          | ✗    | ✗         | out of scope (it's a folder, so it can't be shared)                       |

Rules:

- **The zip round-trips losslessly.** Fields and top-level keys the app doesn't understand (e.g. `SETTINGS`, `VERSION`, future fields) are kept untouched and written back as they were.
- **Brews are re-chunked at 500 on write.** The file names and layout match what the app produces.
- **Templates are written by filling a bundled copy of the official template.** The Readme sheet, the `Bean_Information` enum sheet and the dropdown lists all survive. The bundled copies are trimmed (the 22,000 empty formatted rows removed; about 30 KB total).
- **The Excel export's bean columns differ from the template** (it has an extra "Roast type" column, "Creation date" and "Bean Id"). Before the first release, I'll check how the importer maps them using the Beanconqueror source code and a real import.
- **Enums come from `Bean_Information`**: roasting type, roast degree (14 values), blend, freezing storage. Invalid values are flagged, never silently dropped.

## 2. Features

- **Open files**: file picker, drag and drop, and the Android share target. The app detects the format from the file's contents, not its name.
- **Create from scratch**: an empty roasted template, green template or backup.
- **Full add, edit and delete** on beans, green beans, brews, grinders and methods in a backup. New records get a fresh UUID plus `config.unix_timestamp`.
- **Deleting a bean that brews point to is blocked.** The app offers to archive it instead. The same guard applies to grinders and methods.
- **Converting between formats**: backup beans to a roasted template, and template rows into a backup.
- **Merging**: add a template's rows, or another backup's records, into the open backup. Duplicates are matched by UUID, or by name + roaster.
- **Views**: a cards/grid toggle. Phones start in cards and desktops in the grid, and the app remembers the choice. Both views are virtualized, so thousands of brews stay smooth.
- **Filters**: text search, show or hide archived, and per-type filters (roaster, bean, method, grinder, date range). The grid also sorts.
- **Validation**: each field is checked as you type, and a summary of problems is shown before export.
- **Output**: Download, plus Share through the Web Share API (the Android share sheet: Drive, Quick Share, Gmail, and so on). No cloud API keys.
- **Later, handled in its own thread**: "paste a roaster URL and fill the bean in" via Jina Reader. It needs the network, so it's disabled offline.

## 3. Offline, service worker, share target

- Built with vite-plugin-pwa in `injectManifest` mode, with our own service worker.
- **The whole build is precached**: every JS chunk, CSS, the self-hosted fonts, icons and the bundled templates. After the first visit nothing needs the network.
- **The manifest has a `share_target`** (POST, multipart) for files only: `.zip` and `.xlsx`, plus `application/zip`, `application/x-zip-compressed` and the xlsx MIME type. `application/octet-stream` is not accepted, so the app doesn't show up for every unknown file. Links are not shared to the app: the URL autofill is a "Paste link" field in the UI. The service worker catches the POST, stores the file in IndexedDB, and redirects (303) to `/?shared-file=1`. This works offline.
- **Opening a shared file**: it goes straight into the editor. Only if unsaved work exists does the app ask: replace, merge, or cancel.
- **Updates**: a new version waits in the background. An "Update available" banner switches over when tapped, so nothing reloads while you're editing.
- **An automated Playwright test runs with the network cut**: open a backup, edit it, export it, and share a file into it.

## 4. Unsaved work

- The working document lives in IndexedDB (idb-keyval), saved automatically after each edit with a short delay.
- **Stored data has a version number.** On load it's checked against a Valibot schema, and older versions are converted forward.
- **If stored data fails the check**, it's never discarded silently. A banner offers "Download what was saved" or "Start fresh".
- The original file's bytes are kept too, so unknown fields can be written back.

## 5. Stack

- **Svelte 5 (runes) + TypeScript (strict) + Vite.** No SvelteKit, just a single-page app.
- **UI**: shadcn-svelte (Bits UI + Tailwind CSS 4) and Lucide icons. The look is clean and airy like gpx.studio and bentopdf, with the theme following the system's light or dark setting.
- **Tables and lists**: TanStack Table + TanStack Virtual.
- **Validation**: Valibot, with one set of schemas shared by forms, imports and stored data.
- **i18n**: Paraglide JS. English only in v1, with every string in a messages file.
- **Files**: fflate (zip) and SheetJS (reading xlsx). Templates are written by patching the bundled template's sheet XML inside its zip, so the data validations are kept.
- **Storage**: idb-keyval.
- **Deploy**: Wrangler to Cloudflare (static assets), with a `_headers` file: no-cache for `sw.js` and `index.html`, immutable caching for hashed assets, and a strict content security policy. Preview deploys per branch.

## 6. Performance and code splitting

- **The initial load is just the shell**: layout, empty state and file picker.
- **Heavy code is lazy-loaded**: SheetJS, fflate, TanStack Table and the editors come in through dynamic `import()`, shown in Svelte with `{#await}` blocks and skeleton placeholders (Svelte's version of suspense). The bundled templates are fetched only when you create or write one.
- **Parsing and writing big files happens in a Web Worker**, so the interface never freezes.
- Lazy chunks are still precached by the service worker, so lazy loading only speeds up startup and never costs offline use.
- **Budget**: the initial JavaScript stays under 100 KB gzipped, enforced in CI with a size check.

## 7. Quality gates (CI on every PR, via GitHub Actions)

- `svelte-check` + `tsc --noEmit`, plus ESLint (flat config) and Prettier.
- **Vitest unit tests** for every parser and writer. **Round-trip tests** use fixtures made from the four sample files, anonymized: read, write, read again, and compare.
- **Playwright end-to-end tests** in Chromium: open, edit, export, the offline run, and the share-target POST handled by the service worker.
- **Lighthouse CI**: PWA installable, accessibility score ≥ 95.
- **Size budget check.**
- Accessibility throughout: every control reachable by keyboard, visible focus, labels on every field, and color contrast that meets WCAG AA.

## 8. Milestones

1. **Scaffold**: repo, CI, Cloudflare deploy, PWA shell with offline use and the share target working end to end with a stub file viewer.
2. **Formats**: parsers and writers for all four formats, with round-trip tests.
3. **Editor**: cards and grid, filters, forms, the guard on deleting referenced records, and saving unsaved work.
4. **Convert and merge**, plus the export validation summary.
5. **Polish**: empty states, error handling, the translation pass, Lighthouse, and a README.
6. (Separate thread) URL autofill.
