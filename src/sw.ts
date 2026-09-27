/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { putSharedFile, SHARE_TARGET_PATH, SHARED_FILE_PARAM } from './lib/share/inbox';

declare const self: ServiceWorkerGlobalScope;

// Registered first so the share POST is answered before Workbox sees it.
async function handleShare(request: Request): Promise<Response> {
  const redirect = (params: Record<string, string> = {}) =>
    Response.redirect(`/?${new URLSearchParams(params).toString()}`, 303);
  try {
    const form = await request.formData();
    const file = form.getAll('file').find((f): f is File => f instanceof File && f.size > 0);
    if (file) {
      await putSharedFile({
        name: file.name,
        type: file.type,
        bytes: await file.arrayBuffer(),
        receivedAt: Date.now(),
      });
      return redirect({ [SHARED_FILE_PARAM]: '1' });
    }
    return redirect();
  } catch {
    return redirect();
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method === 'POST' &&
    url.origin === self.location.origin &&
    url.pathname === SHARE_TARGET_PATH
  ) {
    event.respondWith(handleShare(event.request));
  }
});

// Precache the whole build (lazy chunks and bundled templates included) so the app works offline.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

// The page decides when to activate a new version ("Update available" banner).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
clientsClaim();
