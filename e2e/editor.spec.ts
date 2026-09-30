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
  await page.getByRole('button', { name: 'Add bean', exact: true }).click();
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
        const request = indexedDB.open('beans-editor');
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
  expect(download.suggestedFilename()).toBe('beans-editor-unsaved-work.json');
  await banner.getByRole('button', { name: 'Start fresh' }).click();
  await expect(banner).toBeHidden();
  await page.reload();
  await expect(page.getByTestId('invalid-draft')).toBeHidden();
});

test('edits a brew and deletes another', async ({ page }) => {
  const data = backupData();
  data.BREWS.push({
    bean: 'bean-unused',
    mill: 'mill-1',
    method_of_preparation: 'prep-1',
    config: { uuid: 'brew-2', unix_timestamp: 1_700_100_000 },
  });
  await openBackup(page, data);
  await page.getByRole('tab', { name: 'Brews (2)' }).click();
  await expect(page.getByTestId('brews-count')).toHaveText('Showing 2 of 2');

  // Phones fold the filters behind a toggle; wider screens always show them.
  const toggle = page.locator('button[aria-controls="brew-filters"]');
  if (await toggle.isVisible()) await toggle.click();
  await page.getByRole('combobox', { name: /^Bean/ }).selectOption({ label: 'Unused Lot' });
  await expect(page.getByTestId('brews-count')).toHaveText('Showing 1 of 2');
  if (await toggle.isVisible()) await expect(toggle).toHaveText('Filters: 1');
  await page.getByRole('button', { name: 'Clear filters' }).click();

  await page.getByRole('listitem').filter({ hasText: 'Finca Example' }).getByRole('button').click();
  const dialog = page.getByTestId('brew-dialog');
  await dialog.getByLabel('Grind size').fill('18');
  await dialog.getByLabel('Dose (g)').fill('15.5');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('listitem').filter({ hasText: 'Unused Lot' }).getByRole('button').click();
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await dialog.getByRole('alert').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('tab', { name: 'Brews (1)' })).toBeVisible();

  const brews = (await downloadBackup(page))['BREWS'];
  expect(brews).toEqual([{ ...data.BREWS[0], grind_size: '18', grind_weight: 15.5 }]);
});

test('keeps long brew lists fast by rendering only the rows in view', async ({ page }) => {
  const data = backupData();
  data.BREWS = Array.from({ length: 3000 }, (_, i) => ({
    bean: 'bean-used',
    mill: 'mill-1',
    method_of_preparation: 'prep-1',
    note: `brew number ${i}`,
    config: { uuid: `brew-${i}`, unix_timestamp: 1_700_000_000 + i * 60 },
  }));
  await openBackup(page, data);
  await page.getByRole('tab', { name: 'Brews (3000)' }).click();
  const list = page.getByRole('list', { name: 'Brews' });
  await expect(list.getByRole('listitem').first()).toBeVisible();
  expect(await list.getByRole('listitem').count()).toBeLessThan(60);

  await page.getByRole('searchbox', { name: 'Search brews' }).fill('number 2999');
  await expect(page.getByTestId('brews-count')).toHaveText('Showing 1 of 3000');
});

test('adds a grinder and guards grinders and methods that brews use', async ({ page }) => {
  await openBackup(page);
  await page.getByRole('tab', { name: 'Grinders (1)' }).click();
  await page.getByRole('button', { name: 'Add grinder' }).click();
  const dialog = page.getByTestId('gear-dialog');
  await dialog.getByLabel('Name').fill('Hand grinder');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('tab', { name: 'Grinders (2)' })).toBeVisible();

  await page.getByRole('button', { name: /^Grinder/ }).click();
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await expect(dialog.getByRole('alert')).toContainText('brews use it (brews: 1)');
  await dialog.getByRole('button', { name: 'Cancel' }).last().click();

  await page.getByRole('tab', { name: 'Methods (1)' }).click();
  await page.getByRole('button', { name: /V60/ }).click();
  await dialog.getByLabel('Name').fill('V60 02');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: /V60 02/ })).toBeVisible();

  const json = await downloadBackup(page);
  expect(json['PREPARATION']).toEqual([
    { name: 'V60 02', config: { uuid: 'prep-1', unix_timestamp: 1_700_000_000 } },
  ]);
  expect((json['MILL'] as { name: string }[]).map((g) => g.name)).toEqual(['Grinder', 'Hand grinder']);
});
