import type { ManifestOptions } from 'vite-plugin-pwa';

export const manifest: Partial<ManifestOptions> = {
  id: '/',
  name: 'Beans Editor',
  short_name: 'Beans Editor',
  description: 'Edit Beanconqueror backups offline, in your browser.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  theme_color: '#8F5B40',
  background_color: '#8F5B40',
  icons: [
    { src: '/favicon.ico', sizes: '16x16 32x32', type: 'image/x-icon' },
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  share_target: {
    action: '/share-target',
    method: 'POST',
    enctype: 'multipart/form-data',
    // Backups open in the editor; a shared product page becomes a Beanconqueror bean link.
    params: {
      title: 'title',
      text: 'text',
      url: 'url',
      files: [
        {
          name: 'file',
          // Android often labels a zip as a generic binary file; the app checks contents anyway.
          accept: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream', '.zip'],
        },
      ],
    },
  },
};
