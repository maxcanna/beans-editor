import { expect, test, type Page } from '@playwright/test';
import { backupData, backupZip, readBackupJson, sharePost, waitForServiceWorker } from './helpers';

async function openBackup(page: Page, data?: object) {
  await page.getByTestId('file-input').setInputFiles({
    name: 'my-backup.zip',
    mimeType: 'application/zip',
    buffer: backupZip(data),
  });
  await expect(page.getByTestId('backup-editor')).toBeVisible();
}

async function downloadBackup(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download backup' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('my-backup.zip');
  const path = await download.path();
  const { readFileSync } = await import('node:fs');
  return readBackupJson(readFileSync(path));
}

async function renameUnusedLot(page: Page, name: string) {
  await page.getByRole('button', { name: /Unused Lot/ }).click();
  const dialog = page.getByTestId('bean-dialog');
  await dialog.getByLabel('Name').fill(name);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('edits a bean and downloads a backup that keeps everything else', async ({ page }) => {
  await openBackup(page);
  await page.getByRole('button', { name: /Finca Example/ }).click();
  const dialog = page.getByTestId('bean-dialog');
  await dialog.getByLabel('Roaster').fill('New Roasters');
  await dialog.getByLabel('Degree of roast').selectOption('FULL_CITY_ROAST');
  await dialog.getByRole('button', { name: 'Add origin' }).click();
  await dialog.getByLabel('Country').fill('Kenya');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('save-state')).toHaveText('Unsaved changes');

  const json = await downloadBackup(page);
  await expect(page.getByTestId('save-state')).toHaveText('All changes downloaded');
  const expected = backupData();
  expect(json).toEqual({
    ...expected,
    BEANS: [
      {
        ...expected.BEANS[0],
        roaster: 'New Roasters',
        roast: 'FULL_CITY_ROAST',
        bean_information: [
          {
            purchasing_price: 0,
            fob_price: 0,
            country: 'Kenya',
            region: '',
            farm: '',
            farmer: '',
            elevation: '',
            variety: '',
            processing: '',
            harvest_time: '',
            certification: '',
            percentage: 0,
          },
        ],
      },
      expected.BEANS[1],
    ],
  });
});

test('adds a bean with the fields the app expects', async ({ page }) => {
  await openBackup(page);
  await page.getByRole('button', { name: 'Add bean' }).click();
  const dialog = page.getByTestId('bean-dialog');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.getByText('Required')).toBeVisible();
  await expect(dialog.getByLabel('Name')).toBeFocused();

  await dialog.getByLabel('Name').fill('Brand New');
  await dialog.getByLabel('Roast date').fill('2025-04-30');
  await dialog.getByLabel('Weight (g)').fill('1000');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('backup-editor')).toContainText('Beans: 3');

  const beans = (await downloadBackup(page))['BEANS'] as Record<string, unknown>[];
  const added = beans.at(-1)!;
  expect(added).toMatchObject({ name: 'Brand New', weight: 1000, beanMix: 'SINGLE_ORIGIN', finished: false });
  expect(added['config']).toMatchObject({ uuid: expect.stringMatching(/^[0-9a-f-]{36}$/) });
  expect(new Date(added['roastingDate'] as string).getDate()).toBe(30);
});

test('blocks deleting a bean that brews use and offers to archive it', async ({ page }) => {
  await openBackup(page);
  await page.getByRole('button', { name: /Finca Example/ }).click();
  const dialog = page.getByTestId('bean-dialog');
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await expect(dialog.getByRole('alert')).toContainText("can't be deleted because brews use it (brews: 1)");
  await dialog.getByRole('alert').getByRole('button', { name: 'Archive' }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole('button', { name: /Finca Example/ })).toBeHidden();
  await page.getByLabel('Show archived').check();
  await expect(page.getByRole('button', { name: /Finca Example/ })).toBeVisible();
});

test('deletes a bean no brew uses', async ({ page }) => {
  await openBackup(page);
  await page.getByRole('button', { name: /Unused Lot/ }).click();
  const dialog = page.getByTestId('bean-dialog');
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await dialog.getByRole('alert').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('button', { name: /Unused Lot/ })).toBeHidden();
  await expect(page.getByTestId('backup-editor')).toContainText('Beans: 1');
});

test('searches and switches between cards and grid', async ({ page }) => {
  await openBackup(page);
  await page.getByRole('button', { name: 'Cards' }).click();
  await expect(page.getByTestId('bean-cards')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search beans' }).fill('other');
  await expect(page.getByRole('button', { name: /Unused Lot/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Finca Example/ })).toBeHidden();

  await page.getByRole('button', { name: 'Grid' }).click();
  await expect(page.getByTestId('bean-grid')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('bean-grid')).toBeVisible();
});

test('restores unsaved work after a reload', async ({ page }) => {
  await openBackup(page);
  await renameUnusedLot(page, 'Renamed Lot');

  await page.reload();
  await expect(page.getByText('Restored the backup you were editing.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Renamed Lot/ })).toBeVisible();
  await expect(page.getByTestId('save-state')).toHaveText('Unsaved changes');
});

test('asks before a shared backup replaces unsaved changes', async ({ page }) => {
  await waitForServiceWorker(page);
  await openBackup(page);
  await renameUnusedLot(page, 'Renamed Lot');
  const shared = { file: { name: 'other.zip', mimeType: 'application/zip', bytes: [...backupZip()] } };

  await sharePost(page, shared);
  const prompt = page.getByRole('alertdialog');
  await expect(prompt).toContainText('Opening other.zip replaces them.');
  await prompt.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByRole('button', { name: /Renamed Lot/ })).toBeVisible();

  await sharePost(page, shared);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace' }).click();
  await expect(page.getByRole('button', { name: /Unused Lot/ })).toBeVisible();
  await expect(page.getByTestId('save-state')).toHaveText('All changes downloaded');
});

test('offers to download stored work that no longer passes the check', async ({ page }) => {
  await waitForServiceWorker(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('bean-editor');
        request.onupgradeneeded = () => request.result.createObjectStore('drafts');
        request.onsuccess = () => {
          const tx = request.result.transaction('drafts', 'readwrite');
          tx.objectStore('drafts').put({ version: 1, data: { BEANS: 'broken' } }, 'draft');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  const banner = page.getByTestId('invalid-draft');
  await expect(banner).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    banner.getByRole('button', { name: 'Download what was saved' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('bean-editor-unsaved-work.json');
  await banner.getByRole('button', { name: 'Start fresh' }).click();
  await expect(banner).toBeHidden();
  await page.reload();
  await expect(page.getByTestId('invalid-draft')).toBeHidden();
});
