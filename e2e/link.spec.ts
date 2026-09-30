import { expect, test, type Page } from '@playwright/test';
import { backupZip, readBackupJson } from './helpers';

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

/** Opens a backup, then "Add bean from URL" in its editor. */
async function openFromEditor(page: Page) {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles({
    name: 'Beanconqueror.zip',
    mimeType: 'application/zip',
    buffer: backupZip(),
  });
  await page.getByRole('button', { name: 'Add bean from URL' }).click();
  const dialog = page.getByTestId('add-from-link');
  await expect(dialog.getByRole('heading', { name: 'Add a bean from a URL' })).toBeVisible();
  return dialog;
}

test('offers Add bean from URL only in the backup editor, not on the home screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('howto')).toBeVisible();
  await expect(page.getByRole('button', { name: /from (a )?(URL|link)/i })).toHaveCount(0);
  await openFromEditor(page);
});

test('reads a shared product page and opens the bean in Beanconqueror', async ({ page }) => {
  await mockJina(page);
  await page.goto(`/?shared-link=${encodeURIComponent(PRODUCT)}`);
  const dialog = page.getByTestId('add-from-link');

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

async function reviewBean(page: Page) {
  await mockJina(page);
  await page.goto(`/?shared-link=${encodeURIComponent(PRODUCT)}`);
  const dialog = page.getByTestId('add-from-link');
  return dialog;
}

// One tap per test: headless Chromium swallows input after an unhandled custom-scheme link.
test('says when Beanconqueror did not open', async ({ page }) => {
  const dialog = await reviewBean(page);
  const status = dialog.getByTestId('open-status');
  // No app handles the link here, so the page stays in front.
  await dialog.getByTestId('open-in-beanconqueror').click();
  await expect(status).toContainText('Opening Beanconqueror');
  await expect(status).toContainText("Beanconqueror didn't open");
});

test('confirms the bean was sent when Beanconqueror takes over', async ({ page }) => {
  const dialog = await reviewBean(page);
  const status = dialog.getByTestId('open-status');
  await dialog.getByTestId('open-in-beanconqueror').click();
  // When the app opens, the page is hidden.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(status).toContainText('Sent to Beanconqueror');
});

test('starts reading as soon as a link is pasted', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await mockJina(page);
  const dialog = await openFromEditor(page);
  await page.evaluate((text) => navigator.clipboard.writeText(text), PRODUCT);
  await dialog.getByLabel('Product page URL').focus();
  await page.keyboard.press('ControlOrMeta+V');
  await expect(dialog.getByLabel('Name')).toHaveValue('Colombia Motta');
});

test('says when the shop page is gone and lets the bean be filled in by hand', async ({ page }) => {
  await mockJina(page, 'Warning: Target URL returned error 404: Not Found');
  const dialog = await openFromEditor(page);
  await dialog.getByLabel('Product page URL').fill('https://roaster.example/products/ethiopia-guji');
  await expect(dialog.getByRole('alert')).toContainText('no longer exists');

  await dialog.getByRole('button', { name: 'Fill in by hand' }).click();
  await expect(dialog.getByLabel('Name')).toHaveValue('Ethiopia Guji');
  await expect(dialog.getByLabel('Website')).toHaveValue('https://roaster.example/products/ethiopia-guji');
});

test('reads a typed link without a button and shows that it is reading', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('https://r.jina.ai/**', async (route) => {
    await held;
    await route.fulfill({ status: 200, body: PAGE, headers: { 'access-control-allow-origin': '*' } });
  });
  const dialog = await openFromEditor(page);
  await expect(dialog.getByRole('button', { name: 'Read page' })).toHaveCount(0);
  await dialog.getByLabel('Product page URL').pressSequentially(PRODUCT);
  await expect(dialog.getByTestId('link-reading')).toContainText('Reading roaster.example');
  await expect(dialog.getByRole('button', { name: 'Skip, fill in by hand' })).toBeVisible();
  release();
  await expect(dialog.getByLabel('Name')).toHaveValue('Colombia Motta');
});

test('offers Try again after a failed read', async ({ page }) => {
  let calls = 0;
  await page.route('https://r.jina.ai/**', (route) =>
    ++calls === 1
      ? route.fulfill({ status: 500, body: 'boom', headers: { 'access-control-allow-origin': '*' } })
      : route.fulfill({ status: 200, body: PAGE, headers: { 'access-control-allow-origin': '*' } }),
  );
  await page.goto(`/?shared-link=${encodeURIComponent(PRODUCT)}`);
  const dialog = page.getByTestId('add-from-link');
  await expect(dialog.getByRole('alert')).toBeVisible();
  await dialog.getByRole('button', { name: 'Try again' }).click();
  await expect(dialog.getByLabel('Name')).toHaveValue('Colombia Motta');
});

test('adds the bean to the open backup when started from the editor', async ({ page }) => {
  await mockJina(page);
  const dialog = await openFromEditor(page);
  await dialog.getByLabel('Product page URL').fill(PRODUCT);
  await expect(dialog.getByLabel('Name')).toHaveValue('Colombia Motta');
  await expect(dialog.getByTestId('open-in-beanconqueror')).toHaveCount(0);
  await expect(dialog.getByText("Your backup isn't changed.")).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Add to backup' }).click();

  await expect(dialog).toHaveCount(0);
  const editor = page.getByTestId('backup-editor');
  await expect(editor).toContainText('Beans: 3');
  await expect(editor).toContainText('Colombia Motta');
  await expect(page.getByTestId('save-state')).toContainText('Unsaved');
});

// Dates on the page are left alone: the user types them.
const PAGE_WITH_DATES = `${PAGE}Roast date: 15/09/2026\nBest before: 15/03/2027\n`;

test('puts the roast date in the link, but not what the app would drop', async ({ page }) => {
  await mockJina(page, PAGE_WITH_DATES);
  await page.goto(`/?shared-link=${encodeURIComponent(PRODUCT)}`);
  const dialog = page.getByTestId('add-from-link');

  await expect(dialog.getByLabel('Name')).toHaveValue('Colombia Motta');
  await expect(dialog.getByLabel('Roast date')).toHaveValue('');
  await dialog.getByLabel('Roast date').fill('2026-09-15');
  // Beanconqueror's Add Bean screen ignores a shared buy date.
  await expect(dialog.getByLabel('Buy date')).toHaveCount(0);
  await expect(dialog.getByLabel('Best before')).toHaveCount(0);
  await expect(dialog.getByLabel('Freeze date', { exact: true })).toHaveCount(0);
  await expect(dialog.getByTestId('backup-only-fields')).toBeVisible();

  const href = (await dialog.getByTestId('open-in-beanconqueror').getAttribute('href'))!;
  const payload = new URL(href).searchParams.get('shareUserBean0')!;
  const bytes = Buffer.from(payload, 'base64').toString('latin1');
  const iso = (day: string) => page.evaluate((d) => new Date(`${d}T00:00:00`).toISOString(), day);
  expect(bytes).toContain(await iso('2026-09-15'));
});

test('adds dates and freezing details to a backup bean', async ({ page }) => {
  await mockJina(page, PAGE_WITH_DATES);
  const dialog = await openFromEditor(page);
  await dialog.getByLabel('Product page URL').fill(PRODUCT);

  await expect(dialog.getByLabel('Best before')).toHaveValue('');
  await dialog.getByLabel('Roast date').fill('2026-09-15');
  await dialog.getByLabel('Buy date').fill('2026-09-18');
  await dialog.getByLabel('Best before').fill('2027-03-15');
  await dialog.getByLabel('Freeze date', { exact: true }).fill('2026-09-25');
  await dialog.getByLabel('Freezing storage type').selectOption({ label: 'Coffee bag' });
  await dialog.getByLabel('Freezing notes').fill('Top shelf');
  await dialog.getByRole('button', { name: 'Add to backup' }).click();
  await expect(dialog).toHaveCount(0);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download backup' }).click(),
  ]);
  const { readFileSync } = await import('node:fs');
  const beans = readBackupJson(readFileSync(await download.path()))['BEANS'] as Record<string, unknown>[];
  const bean = beans.find((b) => b['name'] === 'Colombia Motta')!;
  const iso = (day: string) => page.evaluate((d) => new Date(`${d}T00:00:00`).toISOString(), day);
  expect(bean).toMatchObject({
    roastingDate: await iso('2026-09-15'),
    buyDate: await iso('2026-09-18'),
    bestDate: await iso('2027-03-15'),
    frozenDate: await iso('2026-09-25'),
    unfrozenDate: '',
    frozenStorageType: 'COFFEE_BAG',
    frozenNote: 'Top shelf',
  });
  expect(bean['frozenId']).toMatch(/^\w{6}$/);
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

test('reads a shared product page and lets the user add dates before opening Beanconqueror', async ({
  page,
}) => {
  let answer: () => void = () => {};
  const answered = new Promise<void>((resolve) => (answer = resolve));
  await page.route('https://r.jina.ai/**', async (route) => {
    await answered;
    await route.fulfill({ status: 200, body: PAGE, headers: { 'access-control-allow-origin': '*' } });
  });
  // Where the service worker sends a shared link.
  await page.goto(`/?shared-link=${encodeURIComponent(PRODUCT)}`);

  const dialog = page.getByTestId('add-from-link');
  await expect(dialog.getByTestId('link-reading')).toContainText('Reading roaster.example');
  await expect(page).toHaveURL(/\/$/);
  answer();

  await expect(dialog.getByLabel('Name')).toHaveValue('Colombia Motta');
  await dialog.getByLabel('Roast date').fill('2026-09-15');
  const href = (await dialog.getByTestId('open-in-beanconqueror').getAttribute('href'))!;
  const bytes = Buffer.from(new URL(href).searchParams.get('shareUserBean0')!, 'base64').toString('latin1');
  expect(bytes).toContain('Colombia Motta');
  expect(bytes).toContain(await page.evaluate(() => new Date('2026-09-15T00:00:00').toISOString()));
});

test('offers to fill in a shared link by hand when the page can’t be read', async ({ page }) => {
  await page.route('https://r.jina.ai/**', (route) =>
    route.fulfill({ status: 500, body: '', headers: { 'access-control-allow-origin': '*' } }),
  );
  await page.goto(`/?shared-link=${encodeURIComponent(PRODUCT)}`);
  const dialog = page.getByTestId('add-from-link');
  await expect(dialog.getByRole('alert')).toContainText("Couldn't read this page");
  await dialog.getByRole('button', { name: 'Fill in by hand' }).click();
  await expect(dialog.getByLabel('Name')).toHaveValue('Colombia Motta');
  await expect(dialog.getByTestId('open-in-beanconqueror')).toHaveAttribute('href', /^beanconqueror:/);
});
