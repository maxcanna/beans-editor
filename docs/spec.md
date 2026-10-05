# Beans Editor: spec v1

Repository: `maxcanna/beans-editor` (private). Hosting: Cloudflare (static assets, free tier).
A backend-free Progressive Web App (PWA) that edits Beanconqueror backups and adds beans to Beanconqueror from a roaster's product page. Everything runs in the browser, and the app works fully offline after the first visit (reading a product page needs the network).

## 0. Flows

1. **Share a URL** (Android share sheet → Beans Editor): Beans Editor opens the same bean dialog as flow 4, already reading the shared page (spinner and "Reading <shop>…"). When the fields show, the user can fix them and add the roast date, then taps Open in Beanconqueror, which opens its Add Bean screen filled in. The tap also means Chrome never has to open an app on its own. If the page can't be read (offline, slow, gone) the dialog says so and offers to fill in by hand. The backup is never touched.
2. **Share a zip**: the file's contents are checked; a valid backup opens in the editor, anything else gets a message saying how to export a backup from the app.
3. **Open the app directly**: pick or drop a zip (same check), edit the backup, and download it.
4. **Add a bean from a URL in the app**: paste a product page URL, the bean's fields are extracted and shown for review, then "Open in Beanconqueror" opens the app's Add Bean screen with the same link as flow 1. Reading starts as soon as a URL is pasted or typed, with a spinner while it runs; there is no Read button, only Try again after a failed read. On the home screen it opens from a URL shared by another app, or from the "Add bean from URL" button, which shows only on touch devices (no hover, or a coarse pointer) and is hidden on desktop; there the bean goes to Beanconqueror with no backup touched. Opened with "Add bean from URL" while editing a backup, the button is "Add to backup" instead, and the reviewed bean is added to that backup. Dates are never read from the page: the user types them. The review form has the roast date, which the link carries; the buy date, the best before date and the freezing details (freeze and unfreeze dates, storage type, notes) appear only when adding to a backup. BeanProto has no fields for the best before date or freezing, and the app drops what it doesn't know; it does have a buy date, but Beanconqueror's Add Bean screen doesn't copy it from a shared bean.

## 1. File formats

**Only the backup zip is supported.** It's the only format that holds everything Beanconqueror stores, so it's the only one that guarantees no data loss. The bean Excel templates and the Excel export are out of scope: they carry a subset of the data, and the export is localized and lossy.

| Format                                                                                           | Read | Write | Beanconqueror import path                           |
| ------------------------------------------------------------------------------------------------ | ---- | ----- | --------------------------------------------------- |
| Backup zip (`Beanconqueror.json` + `Beanconqueror_Brews_N.json`, brews split into chunks of 500) | ✓    | ✓     | Settings › Import                                   |
| Roasted/green bean templates, Excel export (xlsx)                                                | ✗    | ✗     | out of scope (lossy)                                |
| Full export to a folder                                                                          | ✗    | ✗     | out of scope (it's a folder, so it can't be shared) |

Rules:

- **The zip round-trips losslessly.** Fields and top-level keys the app doesn't understand (e.g. `SETTINGS`, `VERSION`, future fields) are kept untouched and written back as they were.
- **Brews are re-chunked at 500 on write.** The file names and layout match what the app produces.
- **Enums** (roasting type, roast degree, blend) use the app's codes; unknown values are kept, never silently dropped.

## 2. Features

- **Open files**: file picker, drag and drop, and the Android share target. A file is judged by its contents, not its name; anything that isn't a backup gets a message saying how to export one from the app.
- **Full add, edit and delete** on beans, green beans and brews in a backup, and edit and delete on grinders and methods (new grinders and methods are created in the Beanconqueror app, which fills in settings only it knows). New records get a fresh UUID plus `config.unix_timestamp`.
- **Deleting a bean that brews point to is blocked.** The app offers to archive it instead. The same guard applies to grinders and methods.
- **Merging**: add another backup's records into the open backup. Duplicates are matched by UUID, or by name + roaster.
- **Views**: a cards/grid toggle shared by Beans and Brews. Phones start in cards and desktops in the grid, and the app remembers the choice. Both views are virtualized, so thousands of brews stay smooth.
- **Filters**: text search, Show archived and Show frozen icon toggles (beans in the freezer are hidden until Show frozen is on; both kinds carry a label in their row; on phones the bean switches fold behind the Filters button with the date filters), and per-type filters (roaster, bean, method, grinder, date range). Brews get the same two switches, taken from each brew's bean (brews of archived or frozen beans are hidden until the switch is on, unless that bean is picked in the Bean filter). The grid also sorts.
- **Validation**: each field is checked as you type, and a summary of problems is shown before export.
- **Output**: Download only. There is no Share button: Chromium's Web Share, including Chrome on Android, refuses zip files (it only shares images, media, PDF and text). No cloud API keys.
- **Bean from a URL** (flows 1 and 4): Jina Reader fetches the page (it's the CORS bridge), Shopify product pages also get the shop's product JSON, and rules pull out labelled lines (country, altitude, process…; never dates) in English, Italian, German, French, Spanish and Portuguese (`src/lib/extract`). There is no AI pass for now; what isn't found stays blank on the review form. It needs the network, so it's disabled offline; flow 1 then falls back to a bean named after the link.

## 3. Offline, service worker, share target

- Built with vite-plugin-pwa in `injectManifest` mode, with our own service worker.
- **The whole build is precached**: every JS chunk, CSS, the self-hosted fonts and icons. After the first visit nothing needs the network.
- **The manifest has a `share_target`** (POST, multipart) for backups (`.zip`, `application/zip`, `application/x-zip-compressed`, `application/octet-stream`) and for shared links (`title`, `text`, `url`). `application/octet-stream` is accepted because Android often labels a zip that way, and Chrome drops shared files whose type isn't in `accept`; the contents check still rejects anything that isn't a backup. The service worker catches the POST, stores a file in IndexedDB, and redirects (303) to `/?shared-file=1`. A share with neither a file nor a link redirects to `/?share-empty=1`, and the page says what to share instead. This works offline.
- **Sharing a product page**: the service worker finds the URL in the shared text and redirects (303) to `/?shared-link=<url>`. The page opens the add-from-link dialog on it, which reads the page and, on a tap, opens the app's own bean share link, `beanconqueror://ADD_USER_BEAN?shareUserBean0=…` (BeanProto, base64, 400-character chunks; no allow-list). Beanconqueror's prefilled Add Bean screen is the last review step. The service worker used to redirect straight to the `beanconqueror://` link, but Android Chrome left a blank page instead of opening the app.
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
- **Files**: fflate (zip).
- **Storage**: idb-keyval.
- **Deploy**: Wrangler to Cloudflare (static assets), with a `_headers` file: no-cache for `sw.js` and `index.html`, immutable caching for hashed assets, and a strict content security policy. Preview deploys per branch.

## 6. Performance and code splitting

- **The initial load is just the shell**: layout, empty state and file picker.
- **Heavy code is lazy-loaded**: fflate and the editors come in through dynamic `import()`, shown in Svelte with `{#await}` blocks and skeleton placeholders (Svelte's version of suspense).
- **Parsing and writing big files happens in a Web Worker**, so the interface never freezes.
- Lazy chunks are still precached by the service worker, so lazy loading only speeds up startup and never costs offline use.
- **Budget**: the initial JavaScript stays under 100 KB gzipped, enforced in CI with a size check.

## 7. Quality gates (CI on every PR, via GitHub Actions)

- `svelte-check` + `tsc --noEmit`, plus ESLint (flat config) and Prettier.
- **Vitest unit tests** for the backup reader and writer and the editor logic. **Round-trip tests** use synthetic fixtures: read, write, read again, and compare.
- **Playwright end-to-end tests** in Chromium: open, edit, export, the offline run, and the share-target POST handled by the service worker.
- **Lighthouse CI**: PWA installable, accessibility score ≥ 95.
- **Size budget check.**
- Accessibility throughout: every control reachable by keyboard, visible focus, labels on every field, and color contrast that meets WCAG AA.

## 8. Milestones

1. **Scaffold**: repo, CI, Cloudflare deploy, PWA shell with offline use and the share target working end to end with a stub file viewer.
2. **Formats**: backup reader and writer, with round-trip tests. (Template and export support was built, then removed to keep to the lossless format.)
3. **Backup editor**: open, edit and save a backup zip: beans, brews, grinders and methods, filters, forms, the guard on deleting referenced records, and saving unsaved work.
4. **Share a URL (flow 1)**: bean link encoder, share target for links, service worker redirect; test the redirect on a phone, add the one-button fallback if needed.
5. **Bean from a URL**: page extraction via Jina + rules (+ AI), used by flow 1's redirect and by flow 4's "Add a bean from a URL" screen.
6. **Merge**: add another backup's records into the open one.
7. **Polish**: empty states, error handling, the translation pass, Lighthouse.
