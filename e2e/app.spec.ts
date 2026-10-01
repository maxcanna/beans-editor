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
  for (const tab of ['Beans 2', 'Brews 1', 'Grinders 1', 'Methods 1']) {
    await expect(page.getByRole('tab', { name: tab })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: /Finca Example/ })).toBeVisible();
});

test('explains how to use the app on this device and links to the source', async ({ page, isMobile }) => {
  await page.goto('/');
  const howto = page.getByTestId('howto');
  const step = (name: string) => howto.getByRole('heading', { name });
  // Sharing a backup from Beanconqueror only exists on a phone or tablet.
  if (isMobile) await expect(step('Share a backup from Beanconqueror')).toBeVisible();
  else await expect(step('Share a backup from Beanconqueror')).toBeHidden();
  await expect(step('Open a backup file')).toBeVisible();
  await expect(step('Add a bean from a shop page')).toBeVisible();

  const link = howto.getByRole('listitem').filter({ hasText: 'Add a bean from a shop page' });
  if (isMobile) {
    await expect(link).toContainText(
      'share its URL with Beans Editor, or choose Add bean from URL and paste it',
      {
        useInnerText: true,
      },
    );
  } else {
    await expect(link).toContainText('While editing a backup, choose Add bean from URL', {
      useInnerText: true,
    });
    await expect(link).not.toContainText('Beanconqueror opens its Add Bean screen', { useInnerText: true });
  }
  await expect(page.getByRole('link', { name: 'Open source on GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/maxcanna/beans-editor',
  );
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
    await expect(page.getByRole('heading', { name: 'Beans Editor' })).toBeVisible();
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

  test('says so when a share arrives with nothing to open', async ({ page }) => {
    await page.goto('/');
    await waitForServiceWorker(page);

    await shareText(page, { title: 'Backup', text: 'no link here' });
    await expect(page.getByRole('alert')).toContainText('Nothing to open came through the share');
    await expect(page).toHaveURL(/\/$/);
  });

  test('opens a shared product page in the bean dialog while offline', async ({ page, context }) => {
    await page.goto('/');
    await waitForServiceWorker(page);
    await context.setOffline(true);

    await shareText(page, { title: 'Guji', text: 'Look: https://shop.example/products/guji-natural?v=2' });
    const dialog = page.getByTestId('add-from-link');
    await expect(dialog.getByRole('status').first()).toContainText("You're offline");
    await dialog.getByRole('button', { name: 'Fill in by hand' }).click();
    await expect(dialog.getByLabel('Name')).toHaveValue('Guji Natural');
    const href = (await dialog.getByTestId('open-in-beanconqueror').getAttribute('href'))!;
    expect(href).toMatch(/^beanconqueror:\/\/ADD_USER_BEAN\?shareUserBean0=/);
    const payload = atob(new URL(href).searchParams.get('shareUserBean0') ?? '');
    expect(payload).toContain('Guji Natural');
    expect(payload).toContain('https://shop.example/products/guji-natural?v=2');
    // The share parameter is consumed, so a reload doesn't reopen the dialog.
    await expect(page).toHaveURL(/\/$/);
  });
});
