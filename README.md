# Bean Editor

Create and edit [Beanconqueror](https://beanconqueror.com) files right in your browser: backups (`.zip`), roasted and green bean lists, and Excel exports (`.xlsx`). There's no backend, the app works offline once installed, and your files never leave your device.

## Features

- Opens Beanconqueror backups, bean import templates and Excel exports, and recognises each one by its content.
- Installable PWA that works fully offline.
- On Android, share a `.zip` or `.xlsx` from any app to Bean Editor to open it straight away.
- Light and dark themes that follow your system.

Editing, converting and exporting are in progress; see [docs/spec.md](docs/spec.md).

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

The app is a static site on Cloudflare (Workers static assets, see `wrangler.jsonc`). The easiest setup is Cloudflare's Git integration: in the Cloudflare dashboard, create a Worker from this repository with build command `yarn build`. Every push to `main` then deploys, and other branches get preview URLs.

## Contributing

See [AGENTS.md](AGENTS.md) for architecture, conventions and the definition of done.

## License

[MIT](LICENSE). Bean Editor is an independent project and is not affiliated with Beanconqueror.
