/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { beanLink, findSharedUrl, nameFromUrl } from './lib/beanlink/bean-link';
import { putSharedFile, SHARE_EMPTY_PARAM, SHARE_TARGET_PATH, SHARED_FILE_PARAM } from './lib/share/inbox';

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
    const text = (key: string) => {
      const value = form.get(key);
      return typeof value === 'string' ? value : undefined;
    };
    const page = findSharedUrl(text('url'), text('text'), text('title'));
    if (page) {
      // Straight into Beanconqueror's Add Bean screen, which is where the user reviews it.
      return Response.redirect(beanLink({ name: nameFromUrl(page), url: page.href }), 303);
    }
    return redirect({ [SHARE_EMPTY_PARAM]: '1' });
  } catch {
    return redirect({ [SHARE_EMPTY_PARAM]: '1' });
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

// Precache the whole build (lazy chunks included) so the app works offline.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

// The page decides when to activate a new version ("Update available" banner).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
clientsClaim();
