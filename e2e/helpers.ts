import type { Page } from '@playwright/test';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

const config = (uuid: string, unix_timestamp = 1_700_000_000) => ({ uuid, unix_timestamp });

/** A small synthetic backup: one bean used by a brew, one unused. */
export const backupData = (): {
  BEANS: Record<string, unknown>[];
  BREWS: Record<string, unknown>[];
  [key: string]: unknown;
} => ({
  BEANS: [
    {
      name: 'Finca Example',
      roaster: 'Sample Roasters',
      roast: 'CITY_ROAST',
      weight: 250,
      finished: false,
      config: config('bean-used', 1_700_000_100),
      futureField: 'kept',
    },
    {
      name: 'Unused Lot',
      roaster: 'Other Roasters',
      finished: false,
      config: config('bean-unused', 1_700_000_000),
    },
  ],
  BREWS: [{ bean: 'bean-used', mill: 'mill-1', method_of_preparation: 'prep-1', config: config('brew-1') }],
  MILL: [{ name: 'Grinder', config: config('mill-1') }],
  PREPARATION: [{ name: 'V60', config: config('prep-1') }],
  SETTINGS: [{ bean_rating: 5 }],
  VERSION: [{ app: 'test' }],
});

export const backupZip = (data: object = backupData()) =>
  Buffer.from(zipSync({ 'Beanconqueror.json': strToU8(JSON.stringify(data)) }));

/** Reads Beanconqueror.json from a downloaded backup. */
export function readBackupJson(bytes: Buffer): Record<string, unknown> {
  const files = unzipSync(new Uint8Array(bytes));
  return JSON.parse(strFromU8(files['Beanconqueror.json']!)) as Record<string, unknown>;
}

/** Waits until the service worker controls the page and has precached the build. */
export async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve));
    }
  });
}

/**
 * Reproduces what Android does for a share intent: a top-level multipart POST
 * to the manifest's share_target action, answered by the service worker.
 */
export async function sharePost(
  page: Page,
  data: { file: { name: string; mimeType: string; bytes: number[] } },
) {
  await page.evaluate((d) => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.enctype = 'multipart/form-data';
    form.action = '/share-target';
    const input = document.createElement('input');
    input.type = 'file';
    input.name = 'file';
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(d.file.bytes)], d.file.name, { type: d.file.mimeType }));
    input.files = transfer.files;
    form.append(input);
    document.body.append(form);
    form.submit();
  }, data);
}

/** Shares text to the app the way Android does: a multipart POST to the share target. */
export async function shareText(page: Page, fields: Record<string, string>) {
  await page.evaluate((f) => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.enctype = 'multipart/form-data';
    form.action = '/share-target';
    for (const [name, value] of Object.entries(f)) {
      const input = document.createElement('input');
      input.name = name;
      input.value = value;
      form.append(input);
    }
    document.body.append(form);
    form.submit();
  }, fields);
}
