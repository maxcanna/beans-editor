import type { ManifestOptions } from 'vite-plugin-pwa';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const manifest: Partial<ManifestOptions> = {
  id: '/',
  name: 'Bean Editor',
  short_name: 'Bean Editor',
  description: 'Create and edit Beanconqueror backups and bean lists, offline, in your browser.',
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
    // Files only: links are pasted in the app's UI instead.
    params: {
      files: [
        {
          name: 'file',
          accept: ['application/zip', 'application/x-zip-compressed', XLSX_MIME, '.zip', '.xlsx'],
        },
      ],
    },
  },
};
