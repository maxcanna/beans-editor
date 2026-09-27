import { expect, test } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';
import { backupZip, sharePost, shareText, waitForServiceWorker } from './helpers';

test('opens a backup from the file picker into the editor', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles({
    name: 'Beanconqueror.zip',
    mimeType: 'application/zip',
    buffer: backupZip(),
  });
  await expect(page.getByTestId('backup-editor')).toContainText(
    'Beans: 2 · Brews: 1 · Grinders: 1 · Methods: 1',
  );
  await expect(page.getByRole('button', { name: /Finca Example/ })).toBeVisible();
});

for (const [what, buffer] of [
  ['a file that is not a zip', Buffer.from('hello')],
  ['a zip that is not a backup', Buffer.from(zipSync({ 'notes.txt': strToU8('hello') }))],
] as const) {
  test(`says how to get a backup when given ${what}`, async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('file-input').setInputFiles({
      name: 'beans.zip',
      mimeType: 'application/zip',
      buffer,
    });
    await expect(page.getByRole('alert')).toContainText("This isn't a Beanconqueror backup");
    await expect(page.getByTestId('backup-editor')).toHaveCount(0);
  });
}

test('explains why a broken backup can not be opened', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles({
    name: 'Beanconqueror.zip',
    mimeType: 'application/zip',
    buffer: backupZip({ BEANS: [{ name: 'no config' }] }),
  });
  await expect(page.getByRole('alert')).toContainText("Couldn't open this backup");
});

test.describe('offline', () => {
  test('works offline after the first visit, including lazy chunks', async ({ page, context }) => {
    await page.goto('/');
    await waitForServiceWorker(page);
    await context.setOffline(true);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Bean Editor' })).toBeVisible();
    await page.getByTestId('file-input').setInputFiles({
      name: 'Beanconqueror.zip',
      mimeType: 'application/zip',
      buffer: backupZip(),
    });
    await page.getByRole('tab', { name: /^Brews/ }).click();
    await expect(page.getByTestId('brews-count')).toHaveText('Showing 1 of 1');
  });

  test('receives a shared backup through the share target while offline', async ({ page, context }) => {
    await page.goto('/');
    await waitForServiceWorker(page);
    await context.setOffline(true);

    await sharePost(page, {
      file: { name: 'Beanconqueror.zip', mimeType: 'application/octet-stream', bytes: [...backupZip()] },
    });
    await expect(page.getByTestId('backup-editor')).toBeVisible();
    await expect(page.getByRole('button', { name: /Finca Example/ })).toBeVisible();
    // The share parameter is consumed, so a reload does not re-open the file.
    await expect(page).toHaveURL(/\/$/);
  });

  test('turns a shared product page into a Beanconqueror bean link while offline', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await waitForServiceWorker(page);
    await context.setOffline(true);

    const opened = page.waitForRequest((request) => request.url().startsWith('beanconqueror:'));
    await shareText(page, { title: 'Guji', text: 'Look: https://shop.example/products/guji-natural?v=2' });
    const link = new URL((await opened).url());
    expect(link.href).toMatch(/^beanconqueror:\/\/ADD_USER_BEAN\?shareUserBean0=/);
    const payload = atob(link.searchParams.get('shareUserBean0') ?? '');
    expect(payload).toContain('Guji Natural');
    expect(payload).toContain('https://shop.example/products/guji-natural?v=2');
  });
});
