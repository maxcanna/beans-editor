import type { ManifestOptions } from 'vite-plugin-pwa';

export const manifest: Partial<ManifestOptions> = {
  id: '/',
  name: 'Bean Editor',
  short_name: 'Bean Editor',
  description: 'Edit Beanconqueror backups offline, in your browser.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  theme_color: '#1c1917',
  background_color: '#1c1917',
  icons: [
    { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    { src: '/icons/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
  ],
  share_target: {
    action: '/share-target',
    method: 'POST',
    enctype: 'multipart/form-data',
    // Some apps share zips as octet-stream; the app checks the contents, not the type.
    params: {
      files: [
        {
          name: 'file',
          accept: ['application/zip', 'application/x-zip-compressed', '.zip'],
        },
      ],
    },
  },
};
