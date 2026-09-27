import { expect, test } from '@playwright/test';
import { backupZip, roastedTemplate, sharePost, waitForServiceWorker } from './helpers';

test('opens a backup from the file picker', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles({
    name: 'Beanconqueror.zip',
    mimeType: 'application/zip',
    buffer: backupZip(),
  });
  await expect(page.getByTestId('file-kind')).toHaveText('Beanconqueror backup');
});

test('flags files that are not Beanconqueror files', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles({
    name: 'notes.xlsx',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('hello'),
  });
  await expect(page.getByTestId('file-kind')).toHaveText('Not a Beanconqueror file');
});

test.describe('offline', () => {
  test('works offline after the first visit, including lazy chunks', async ({ page, context }) => {
    await page.goto('/');
    await waitForServiceWorker(page);
    await context.setOffline(true);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Bean Editor' })).toBeVisible();
    await page.getByTestId('file-input').setInputFiles({
      name: 'beans.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: roastedTemplate(),
    });
    await expect(page.getByTestId('file-kind')).toHaveText('Roasted beans list');
  });

  test('receives a shared file through the share target while offline', async ({ page, context }) => {
    await page.goto('/');
    await waitForServiceWorker(page);
    await context.setOffline(true);

    await sharePost(page, {
      file: { name: 'Beanconqueror.zip', mimeType: 'application/octet-stream', bytes: [...backupZip()] },
    });
    await expect(page.getByTestId('file-kind')).toHaveText('Beanconqueror backup');
    // The share parameter is consumed, so a reload does not re-open the file.
    await expect(page).toHaveURL(/\/$/);
  });
});
