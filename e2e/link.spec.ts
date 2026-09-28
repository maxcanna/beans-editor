import { expect, test, type Page } from '@playwright/test';
import { backupZip } from './helpers';

// page.route can't see requests a service worker handles.
test.use({ serviceWorkers: 'block' });

const PRODUCT = 'https://roaster.example/en/shop/colombia-motta/';

// A synthetic page, shaped like Jina Reader's answer for a real roaster site.
const PAGE = `Title: Colombia Motta – Guido

URL Source: ${PRODUCT}

Markdown Content:
# Colombia Motta

€ 18,50

**COUNTRY:** Colombia
**REGION:** Huila
**PROCESSING METHOD:** Washed
Notes: Red apple, panela
Roasting profile – Omni
Weight 250g
`;

async function mockJina(page: Page, body = PAGE) {
  await page.route('https://r.jina.ai/**', (route) =>
    route.fulfill({ status: 200, body, headers: { 'access-control-allow-origin': '*' } }),
  );
}

test('reads a pasted product link and opens the bean in Beanconqueror', async ({ page }) => {
  await mockJina(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Add a bean from a link' }).click();
  const dialog = page.getByTestId('add-from-link');
  await dialog.getByLabel('Product page link').fill(PRODUCT);
  await dialog.getByRole('button', { name: 'Read page' }).click();

  await expect(dialog.getByLabel('Name')).toHaveValue('Colombia Motta');
  await expect(dialog.getByLabel('Roaster')).toHaveValue('Guido');
  await expect(dialog.getByLabel('Weight (g)')).toHaveValue('250');
  await expect(dialog.getByLabel('Cost')).toHaveValue('18.5');
  await expect(dialog.getByLabel('Country')).toHaveValue('Colombia');
  await expect(dialog.getByLabel('Processing')).toHaveValue('Washed');

  await dialog.getByLabel('Name').fill('Motta Red Bourbon');
  const open = dialog.getByTestId('open-in-beanconqueror');
  await expect(open).toHaveAttribute('href', /^beanconqueror:\/\/ADD_USER_BEAN\?shareUserBean0=/);
  const payload = new URL((await open.getAttribute('href'))!).searchParams.get('shareUserBean0')!;
  expect(Buffer.from(payload, 'base64').toString('latin1')).toContain('Motta Red Bourbon');
});

test('starts reading as soon as a link is pasted', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await mockJina(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Add a bean from a link' }).click();
  const dialog = page.getByTestId('add-from-link');
  await page.evaluate((text) => navigator.clipboard.writeText(text), PRODUCT);
  await dialog.getByLabel('Product page link').focus();
  await page.keyboard.press('ControlOrMeta+V');
  await expect(dialog.getByLabel('Name')).toHaveValue('Colombia Motta');
});

test('says when the shop page is gone and lets the bean be filled in by hand', async ({ page }) => {
  await mockJina(page, 'Warning: Target URL returned error 404: Not Found');
  await page.goto('/');
  await page.getByRole('button', { name: 'Add a bean from a link' }).click();
  const dialog = page.getByTestId('add-from-link');
  await dialog.getByLabel('Product page link').fill('https://roaster.example/products/ethiopia-guji');
  await dialog.getByRole('button', { name: 'Read page' }).click();
  await expect(dialog.getByRole('alert')).toContainText('no longer exists');

  await dialog.getByRole('button', { name: 'Fill in by hand' }).click();
  await expect(dialog.getByLabel('Name')).toHaveValue('Ethiopia Guji');
  await expect(dialog.getByLabel('Website')).toHaveValue('https://roaster.example/products/ethiopia-guji');
});

test('offers Add from link next to Add bean without changing the backup', async ({ page }) => {
  await mockJina(page);
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles({
    name: 'Beanconqueror.zip',
    mimeType: 'application/zip',
    buffer: backupZip(),
  });
  await page.getByRole('button', { name: 'From link' }).click();
  const dialog = page.getByTestId('add-from-link');
  await dialog.getByLabel('Product page link').fill(PRODUCT);
  await dialog.getByRole('button', { name: 'Read page' }).click();
  await expect(dialog.getByText("Your backup isn't changed.")).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('backup-editor')).toContainText('Beans: 2');
  await expect(page.getByTestId('save-state')).toContainText('All changes downloaded');
});

test('offers Download and no Share, which browsers refuse for zip files', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles({
    name: 'Beanconqueror.zip',
    mimeType: 'application/zip',
    buffer: backupZip(),
  });
  await expect(page.getByRole('button', { name: 'Download backup' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Share', exact: true })).toHaveCount(0);
});
