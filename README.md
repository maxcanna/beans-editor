# Beans Editor

Edit [Beanconqueror](https://beanconqueror.com) backups (`.zip`) right in your browser. The backup is the only Beanconqueror file that holds everything, so it's the only one Beans Editor reads and writes: nothing is lost on the way back into the app. There's no backend, the app works offline once installed, and your files never leave your device.

## Features

- Add, edit, archive and delete beans; edit and delete brews; edit grinders and methods, and add grinders.
- Records you don't touch are written back exactly as they were.
- Unsaved work is kept in the browser, so a reload or a closed tab loses nothing.
- Installable PWA that works fully offline.
- On Android, share a backup from any app to Beans Editor to open it straight away.
- Share a roaster's product page to Beans Editor and Beanconqueror opens its Add Bean screen, already filled in. No backup needed. For now it fills in the name (from the link) and the link itself.
- Light and dark themes that follow your system.

## Getting started

```sh
corepack enable  # Yarn 4
nvm use          # Node 24
yarn install
yarn dev         # http://localhost:5173
```

The service worker only runs in production builds. To try offline mode and sharing:

```sh
yarn build && yarn preview
```

## Scripts

| Script          | What it does                                                                             |
| --------------- | ---------------------------------------------------------------------------------------- |
| `yarn validate` | Type check, lint, format check, unit tests, build and bundle-size budget                 |
| `yarn test:e2e` | Playwright tests (desktop + Android emulation), including offline and share-target flows |
| `yarn deploy`   | Build and deploy to Cloudflare                                                           |

## Deploying

Beans Editor is a static site, deployed to Cloudflare Workers as static assets (see `wrangler.jsonc`). Connect the repository with Cloudflare's Git integration (Workers Builds):

- **Build command:** `yarn build`
- **Deploy command:** `yarn wrangler deploy`
- Pushes to `main` deploy to production; other branches get preview URLs on `workers.dev`.

To serve it on your own hostname, add a custom domain in the Cloudflare dashboard (Worker › Settings › Domains & Routes). The repository doesn't name one, so deploys never change it.

## Contributing

See [AGENTS.md](AGENTS.md) for architecture, conventions and the definition of done.

## License

[MIT](LICENSE). Beans Editor is an independent project and is not affiliated with Beanconqueror.
