import { expect, test } from '@playwright/test';
import { backupZip, roastedTemplate, sharePost, waitForServiceWorker } from './helpers';

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

test('flags files that are not Beanconqueror files', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles({
    name: 'notes.xlsx',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('hello'),
  });
  await expect(page.getByTestId('file-kind')).toHaveText('Not a Beanconqueror file');
});

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
      name: 'beans.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: roastedTemplate(),
    });
    await expect(page.getByTestId('file-kind')).toHaveText('Roasted beans list');
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
});
