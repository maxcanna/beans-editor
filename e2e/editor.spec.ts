import { expect, test, type Locator, type Page } from '@playwright/test';
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

test('edits the buy date and best before date of a bean', async ({ page }) => {
  await openBackup(page);
  await page.getByRole('button', { name: /Finca Example/ }).click();
  const dialog = page.getByTestId('bean-dialog');
  await expect(dialog.getByLabel('Buy date')).toHaveValue('');
  await expect(dialog.getByLabel('Best before')).toHaveValue('');
  await dialog.getByLabel('Buy date').fill('2026-09-18');
  await dialog.getByLabel('Best before').fill('2027-03-15');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();

  const beans = (await downloadBackup(page))['BEANS'] as Record<string, unknown>[];
  const bean = beans.find((b) => b['name'] === 'Finca Example')!;
  const iso = (day: string) => page.evaluate((d) => new Date(`${d}T00:00:00`).toISOString(), day);
  expect(bean).toMatchObject({ buyDate: await iso('2026-09-18'), bestDate: await iso('2027-03-15') });
  expect(bean['futureField']).toBe('kept');

  await page.getByRole('button', { name: /Finca Example/ }).click();
  await expect(dialog.getByLabel('Buy date')).toHaveValue('2026-09-18');
  await expect(dialog.getByLabel('Best before')).toHaveValue('2027-03-15');
});

test('filters beans by buy date', async ({ page }) => {
  const data = backupData();
  data.BEANS[0]!['buyDate'] = '2026-03-10T12:00:00.000Z';
  data.BEANS[1]!['buyDate'] = '2026-04-10T12:00:00.000Z';
  await openBackup(page, data);
  const finca = page.getByRole('button', { name: /Finca Example/ });
  const unused = page.getByRole('button', { name: /Unused Lot/ });
  // On a phone the filters fold behind a button.
  const toggle = page.getByRole('button', { name: 'Filters', exact: true });
  if (await toggle.isVisible()) await toggle.click();

  await page.getByLabel('Buy date from').fill('2026-04-01');
  await expect(unused).toBeVisible();
  await expect(finca).toBeHidden();
  await page.getByLabel('Buy date to').fill('2026-04-05');
  await expect(unused).toBeHidden();
  await page.getByLabel('Buy date from').fill('2026-03-10');
  await page.getByLabel('Buy date to').fill('2026-03-10');
  await expect(finca).toBeVisible();
  await expect(unused).toBeHidden();

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(finca).toBeVisible();
  await expect(unused).toBeVisible();
});

test('filters beans by roast date', async ({ page }) => {
  const data = backupData();
  data.BEANS[0]!['roastingDate'] = '2026-03-10T12:00:00.000Z';
  data.BEANS[1]!['roastingDate'] = '2026-04-10T12:00:00.000Z';
  await openBackup(page, data);
  const finca = page.getByRole('button', { name: /Finca Example/ });
  const unused = page.getByRole('button', { name: /Unused Lot/ });
  const toggle = page.getByRole('button', { name: 'Filters', exact: true });
  if (await toggle.isVisible()) await toggle.click();

  await page.getByLabel('Roast date from').fill('2026-04-01');
  await expect(unused).toBeVisible();
  await expect(finca).toBeHidden();
  await page.getByLabel('Roast date from').fill('2026-03-01');
  await page.getByLabel('Roast date to').fill('2026-03-31');
  await expect(finca).toBeVisible();
  await expect(unused).toBeHidden();

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(finca).toBeVisible();
  await expect(unused).toBeVisible();
});

test('sorts the bean table by clicking a column header', async ({ page }) => {
  await openBackup(page);
  await page.getByRole('button', { name: 'Grid' }).click();
  const table = page.getByTestId('bean-grid');
  const names = () => table.locator('tbody th button').allInnerTexts();
  // Newest first, until a header is clicked.
  expect(await names()).toEqual(['Finca Example', 'Unused Lot']);

  const roaster = table.getByRole('columnheader', { name: 'Roaster', exact: true });
  await expect(roaster).toHaveAttribute('aria-sort', 'none');
  await roaster.getByRole('button').click();
  await expect(roaster).toHaveAttribute('aria-sort', 'ascending');
  expect(await names()).toEqual(['Unused Lot', 'Finca Example']);
  await roaster.getByRole('button').click();
  await expect(roaster).toHaveAttribute('aria-sort', 'descending');
  expect(await names()).toEqual(['Finca Example', 'Unused Lot']);

  // A third click goes back to the default order; another column starts over.
  await roaster.getByRole('button').click();
  await expect(roaster).toHaveAttribute('aria-sort', 'none');
  await table.getByRole('columnheader', { name: 'Name', exact: true }).getByRole('button').click();
  await expect(roaster).toHaveAttribute('aria-sort', 'none');
  expect(await names()).toEqual(['Finca Example', 'Unused Lot']);
});

test('shows brews as cards or as a table that sorts by column', async ({ page }) => {
  const data = backupData();
  data.BREWS.push({
    bean: 'bean-unused',
    mill: 'mill-1',
    method_of_preparation: 'prep-1',
    grind_weight: 18,
    config: { uuid: 'brew-2', unix_timestamp: 1_700_100_000 },
  });
  await openBackup(page, data);
  await page.getByRole('tab', { name: 'Brews (2)' }).click();
  await page.getByRole('button', { name: 'Cards' }).click();
  await expect(page.getByTestId('brew-cards')).toBeVisible();

  await page.getByRole('button', { name: 'Grid' }).click();
  const table = page.getByTestId('brew-table');
  await expect(table).toBeVisible();
  const beanColumn = () => table.locator('tbody tr:not([aria-hidden]) td:nth-child(2)').allInnerTexts();
  // Newest first, like the cards.
  expect(await beanColumn()).toEqual(['Unused Lot', 'Finca Example']);

  const bean = table.getByRole('columnheader', { name: 'Bean', exact: true });
  await bean.getByRole('button').click();
  await expect(bean).toHaveAttribute('aria-sort', 'ascending');
  expect(await beanColumn()).toEqual(['Finca Example', 'Unused Lot']);
  const dose = table.getByRole('columnheader', { name: 'Dose (g)', exact: true });
  await dose.getByRole('button').click();
  await dose.getByRole('button').click();
  expect(await beanColumn()).toEqual(['Unused Lot', 'Finca Example']);

  // The layout is remembered, and a row opens the brew.
  await page.reload();
  await page.getByRole('tab', { name: 'Brews (2)' }).click();
  await expect(page.getByTestId('brew-table')).toBeVisible();
  await page
    .getByTestId('brew-table')
    .locator('tbody tr', { hasText: 'Finca Example' })
    .getByRole('button')
    .click();
  await expect(page.getByTestId('brew-dialog')).toBeVisible();
});

test('keeps long brew tables fast too', async ({ page }) => {
  const data = backupData();
  data.BREWS = Array.from({ length: 3000 }, (_, i) => ({
    bean: 'bean-used',
    mill: 'mill-1',
    method_of_preparation: 'prep-1',
    config: { uuid: `brew-${i}`, unix_timestamp: 1_700_000_000 + i * 60 },
  }));
  await openBackup(page, data);
  await page.getByRole('tab', { name: 'Brews (3000)' }).click();
  await page.getByRole('button', { name: 'Grid' }).click();
  const rows = page.getByTestId('brew-table').locator('tbody tr:not([aria-hidden])');
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeLessThan(60);
});

// What each field is called, in the order the dialog shows them.
const fieldLabels = (dialog: Locator) =>
  dialog.locator('form input, form select, form textarea').evaluateAll((els) =>
    els.map((el) => {
      const label = el.closest('label');
      // A select's options are in its label too; the label's own text comes first.
      const text = [...(label?.childNodes ?? [])].find(
        (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
      );
      return text?.textContent?.trim() ?? '';
    }),
  );

test('shows the same fields in the same order when adding a bean by hand or from a URL', async ({ page }) => {
  await openBackup(page);
  await page.getByRole('button', { name: 'Add bean', exact: true }).click();
  const bean = page.getByTestId('bean-dialog');
  const byHand = await fieldLabels(bean);
  await page.keyboard.press('Escape');
  await expect(bean).toBeHidden();

  await page.getByRole('button', { name: 'Add bean from URL' }).click();
  const url = page.getByTestId('add-from-link');
  await url.getByRole('button', { name: 'Fill in by hand' }).click();
  const fromUrl = await fieldLabels(url);

  expect(byHand).toEqual(
    expect.arrayContaining(['Buy date', 'Best before', 'Freeze date', 'Rating (0 to 5)']),
  );
  expect(fromUrl).toEqual(byHand);
});

test('includes frozen beans with a Show frozen switch and labels them', async ({ page }) => {
  const data = backupData();
  data.BEANS.push({
    ...data.BEANS[0],
    name: 'Icy Lot',
    frozenDate: '2026-03-01T10:00:00.000Z',
    config: { uuid: 'bean-icy', unix_timestamp: 1_700_200_000 },
  });
  await openBackup(page, data);
  const icy = page.getByRole('button', { name: /Icy Lot/ });
  await expect(page.getByRole('button', { name: /Finca Example/ })).toBeVisible();
  // Hidden until asked for, like archived beans.
  await expect(icy).toBeHidden();

  const show = page.getByRole('switch', { name: 'Show frozen' });
  await expect(show).toHaveAttribute('aria-checked', 'false');
  await show.click();
  await expect(show).toHaveAttribute('aria-checked', 'true');
  await expect(icy).toBeVisible();
  await expect(page.getByRole('button', { name: /Finca Example/ })).toBeVisible();

  // The label is in the row, in both layouts.
  for (const layout of ['Cards', 'Grid']) {
    await page.getByRole('button', { name: layout }).click();
    await expect(page.getByText('Frozen', { exact: true })).toBeVisible();
  }
  await show.click();
  await expect(icy).toBeHidden();
});

test('shows the roast type, not the degree of roast, in the bean table', async ({ page }) => {
  const data = backupData();
  data.BEANS[0] = { ...data.BEANS[0], bean_roasting_type: 'ESPRESSO' };
  await openBackup(page, data);
  await page.getByRole('button', { name: 'Grid' }).click();
  const table = page.getByTestId('bean-grid');
  await expect(table.getByRole('columnheader', { name: 'Degree of roast' })).toHaveCount(0);
  const header = table.getByRole('columnheader', { name: 'Roast type', exact: true });
  await expect(header).toBeVisible();
  await expect(table.locator('tbody tr', { hasText: 'Finca Example' })).toContainText('Espresso');
  await header.getByRole('button').click();
  await expect(header).toHaveAttribute('aria-sort', 'ascending');
});

test('keeps the cards or table choice when switching between Beans and Brews', async ({ page }) => {
  await openBackup(page);
  await page.getByRole('button', { name: 'Cards' }).click();
  await page.getByRole('tab', { name: 'Brews (1)' }).click();
  await expect(page.getByTestId('brew-cards')).toBeVisible();

  await page.getByRole('button', { name: 'Grid' }).click();
  await expect(page.getByTestId('brew-table')).toBeVisible();
  await page.getByRole('tab', { name: /^Beans/ }).click();
  await expect(page.getByTestId('bean-grid')).toBeVisible();

  await page.reload();
  await page.getByRole('tab', { name: 'Brews (1)' }).click();
  await expect(page.getByTestId('brew-table')).toBeVisible();
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
  await page.getByRole('switch', { name: 'Show archived' }).click();
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
  await page.getByRole('button', { name: 'Cards' }).click();
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
  await page.getByRole('button', { name: 'Cards' }).click();
  const list = page.getByRole('list', { name: 'Brews' });
  await expect(list.getByRole('listitem').first()).toBeVisible();
  expect(await list.getByRole('listitem').count()).toBeLessThan(60);

  await page.getByRole('searchbox', { name: 'Search brews' }).fill('number 2999');
  await expect(page.getByTestId('brews-count')).toHaveText('Showing 1 of 3000');
});

test('guards grinders and methods that brews use, and offers no way to add a grinder', async ({ page }) => {
  await openBackup(page);
  await page.getByRole('tab', { name: 'Grinders (1)' }).click();
  await expect(page.getByRole('button', { name: /^Add grinder/ })).toBeHidden();
  const dialog = page.getByTestId('gear-dialog');

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
  expect((json['MILL'] as { name: string }[]).map((g) => g.name)).toEqual(['Grinder']);
});
