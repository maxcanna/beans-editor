import type { Page } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';

export const backupZip = () =>
  Buffer.from(
    zipSync({
      'Beanconqueror.json': strToU8(JSON.stringify({ BEANS: [], BREWS: [], MILL: [], PREPARATION: [] })),
      'Beanconqueror_Brews_1.json': strToU8('[]'),
    }),
  );

export const roastedTemplate = () =>
  Buffer.from(
    zipSync({
      'xl/workbook.xml': strToU8(
        '<workbook><sheets><sheet name="Readme_and_Consistency_Check"/><sheet name="Beans"/><sheet name="Bean_Information"/></sheets></workbook>',
      ),
    }),
  );

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
