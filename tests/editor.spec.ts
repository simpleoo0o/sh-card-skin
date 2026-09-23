import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';

function portraitPng(): Buffer {
  const image = new PNG({ width: 300, height: 500 });
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * 4;
      image.data[offset] = Math.round(35 + x / image.width * 160);
      image.data[offset + 1] = Math.round(55 + y / image.height * 140);
      image.data[offset + 2] = 170;
      image.data[offset + 3] = 255;
    }
  }
  return PNG.sync.write(image);
}

async function uploadPhoto(page: Page): Promise<void> {
  await page.locator('#photo-input').setInputFiles({
    name: 'portrait.png',
    mimeType: 'image/png',
    buffer: portraitPng(),
  });
  await expect(page.getByRole('button', { name: '导出 PNG' })).toBeEnabled();
}

test('initial editor presents the complete starting controls', async ({ page }) => {
  await page.goto('./');

  await expect(page.getByRole('heading', { name: '把喜欢的照片，变成你的卡面' })).toBeVisible();
  await expect(page.getByRole('button', { name: '选择照片' })).toBeVisible();
  await expect(page.getByRole('button', { name: '完整标识' })).toBeVisible();
  await expect(page.getByRole('button', { name: '图形标识' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '经典图形' })).toBeVisible();
  await expect(page.getByRole('button', { name: '官网标识' })).toBeVisible();
  await expect(page.getByRole('button', { name: '导出 PNG' })).toBeDisabled();
  await expect(page.getByRole('slider')).toHaveCount(0);
});

test('official Shanghai preset loads the supplied transparent PNG unchanged', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '官网标识' }).click();

  await expect(page.locator('[data-logo="official"] img')).toHaveAttribute('src', /sptcc-official\.png$/);
  await expect(page.locator('[data-layer="logo"]')).toHaveAttribute('aria-pressed', 'true');
  const response = await page.request.get('./logos/sptcc-official.png');
  expect(response.ok()).toBeTruthy();
  expect(createHash('sha256').update(await response.body()).digest('hex'))
    .toBe('fa99229c252ad2eb742d73a541506e92ec7f69323ef01c27891dd7680d611f4d');
});

test('rotates a covering portrait freely with an in-card handle and still exports', async ({ page }) => {
  await page.goto('./');
  await uploadPhoto(page);

  const handle = page.getByRole('button', { name: '自由旋转照片' });
  await expect(handle).toBeVisible();
  const bounds = await handle.boundingBox();
  const preview = await page.getByTestId('preview-shell').boundingBox();
  expect(bounds).not.toBeNull();
  expect(preview).not.toBeNull();
  if (!bounds || !preview) return;

  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(preview.x + preview.width * 0.72, preview.y + preview.height * 0.23, { steps: 8 });
  await page.mouse.up();

  const angle = Number.parseInt(await page.locator('#angle-output').innerText(), 10);
  expect(Math.abs(angle)).toBeGreaterThan(5);
  expect(Math.abs(angle) % 90).toBeGreaterThan(5);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 PNG' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const exported = PNG.sync.read(Buffer.concat(chunks));
  expect([exported.width, exported.height]).toEqual([1536, 969]);
});

test('desktop editor stays within one viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('./');

  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(720);
  await uploadPhoto(page);
  await page.getByRole('button', { name: '完整标识' }).click();
  await expect(page.locator('[data-layer="logo"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(720);
  await expect(page.getByRole('button', { name: '导出 PNG' })).toBeInViewport();
});

test('desktop heading does not leave an orphaned final line', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');

  const lineWidths = await page.getByRole('heading', { name: '把喜欢的照片，变成你的卡面' }).evaluate((heading) => {
    const range = document.createRange();
    range.selectNodeContents(heading);
    return [...range.getClientRects()].map((rect) => Math.round(rect.width));
  });

  expect(lineWidths.length).toBeLessThanOrEqual(2);
  if (lineWidths.length === 2) {
    const [firstLine = 0, secondLine = 0] = lineWidths;
    expect(secondLine).toBeGreaterThan(firstLine * 0.4);
  }
});

test('uploads a portrait, transforms both layers, and exports an AirCard PNG', async ({ page }) => {
  await page.goto('./');
  await uploadPhoto(page);
  const photoScaleBefore = Number.parseInt(await page.locator('#scale-output').innerText(), 10);
  const canvas = await page.locator('.upper-canvas').boundingBox();
  expect(canvas).not.toBeNull();
  if (!canvas) return;
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await page.mouse.wheel(0, -240);
  await expect.poll(async () => Number.parseInt(await page.locator('#scale-output').innerText(), 10)).toBeGreaterThan(photoScaleBefore);
  await page.getByRole('button', { name: '向右旋转 90 度' }).click();

  await page.getByRole('button', { name: '完整标识' }).click();
  await expect(page.locator('[data-layer="logo"]')).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await page.mouse.wheel(0, -240);
  await expect.poll(async () => Number.parseInt(await page.locator('#scale-output').innerText(), 10)).toBeGreaterThan(100);
  await page.getByRole('button', { name: '向右旋转 90 度' }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 PNG' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const exported = PNG.sync.read(Buffer.concat(chunks));

  expect([exported.width, exported.height]).toEqual([1536, 969]);
  const cornerAlphas = [
    exported.data[3],
    exported.data[(exported.width - 1) * 4 + 3],
    exported.data[((exported.height - 1) * exported.width) * 4 + 3],
    exported.data[(exported.width * exported.height - 1) * 4 + 3],
  ];
  expect(cornerAlphas).toEqual([255, 255, 255, 255]);
});

test('keeps a small custom Logo at its reset size during the first drag', async ({ page }) => {
  await page.goto('./');
  await page.locator('#logo-input').setInputFiles({
    name: 'small.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#0071e3"/></svg>'),
  });
  await expect(page.locator('#scale-output')).toHaveText('100%');

  const canvas = await page.locator('.upper-canvas').boundingBox();
  expect(canvas).not.toBeNull();
  if (!canvas) return;
  const start = { x: canvas.x + canvas.width * 0.2, y: canvas.y + canvas.height * 0.68 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 24, start.y, { steps: 4 });
  await page.mouse.up();

  await expect(page.locator('#scale-output')).toHaveText('100%');
});

test('classic mark preset loads the selected Wikipedia SVG', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '经典图形' }).click();

  await expect(page.locator('[data-logo="classic"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-layer="logo"]')).toHaveAttribute('aria-pressed', 'true');
  const response = await page.request.get('./logos/sptcc-classic.svg');
  expect(response.ok()).toBeTruthy();
  expect(createHash('sha256').update(await response.body()).digest('hex'))
    .toBe('e3025d2e63d86c57ec7851cb02c41ed512e51c2b87d2e48e0ce1e14a6512281c');
});

test('three Logo presets still fit in one desktop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('./');
  await uploadPhoto(page);
  await page.getByRole('button', { name: '经典图形' }).click();

  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(720);
  await expect(page.getByRole('button', { name: '导出 PNG' })).toBeInViewport();
});

test('complete Shanghai preset uses the transparent Logo extracted from the app', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '完整标识' }).click();

  await expect(page.locator('[data-logo="full"] img')).toHaveAttribute('src', /sptcc-app\.webp$/);
  await expect(page.locator('[data-layer="logo"]')).toHaveAttribute('aria-pressed', 'true');
  const response = await page.request.get('./logos/sptcc-app.webp');
  expect(response.ok()).toBeTruthy();
  expect(createHash('sha256').update(await response.body()).digest('hex'))
    .toBe('656858fbc3892782186d3c06fb9887500190c327518d2650682f97a4d6d70ffc');
});

test('keeps the newest Logo when an older load finishes later', async ({ page }) => {
  let fullLogoRequests = 0;
  await page.route('**/logos/sptcc-app.webp', async (route) => {
    fullLogoRequests += 1;
    const response = await route.fetch();
    if (fullLogoRequests > 1) await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'cache-control': 'no-store' },
    });
  });
  await page.goto('./');

  await page.getByRole('button', { name: '完整标识' }).click();
  await page.getByRole('button', { name: '官网标识' }).click();
  await expect(page.getByRole('button', { name: '官网标识' })).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(700);
  await expect(page.getByRole('button', { name: '官网标识' })).toHaveAttribute('aria-pressed', 'true');
});

test('moves keyboard focus into the preview after choosing a layer', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '经典图形' }).click();
  await page.locator('[data-layer="logo"]').click();

  await expect(page.getByTestId('preview-shell')).toBeFocused();
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.locator('[data-layer="logo"]')).toHaveAttribute('aria-pressed', 'true');
});

test('keeps a valid photo after a rejected upload', async ({ page }) => {
  await page.goto('./');
  await uploadPhoto(page);

  await page.locator('#photo-input').setInputFiles({
    name: 'not-an-image.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  });

  await expect(page.locator('#error')).toContainText('照片仅支持 JPG、PNG 或 WebP');
  await expect(page.getByRole('button', { name: '导出 PNG' })).toBeEnabled();
  await expect(page.locator('[data-layer="photo"]')).toHaveAttribute('aria-pressed', 'true');
});

test('keeps a safe custom Logo after rejecting an external SVG reference', async ({ page }) => {
  await page.goto('./');
  await page.locator('#logo-input').setInputFiles({
    name: 'safe.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><rect width="200" height="80" rx="16" fill="#0071e3"/></svg>'),
  });
  await expect(page.locator('[data-layer="logo"]')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('#logo-input').setInputFiles({
    name: 'external.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/a.png" /></svg>'),
  });

  await expect(page.locator('#error')).toContainText('SVG 不能引用外部资源');
  await expect(page.locator('[data-layer="logo"]')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('#logo-input').setInputFiles({
    name: 'external-style.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><style>@import "https://example.com/theme.css";</style></svg>'),
  });
  await expect(page.locator('#error')).toContainText('SVG 不能引用外部资源');
  await expect(page.locator('[data-layer="logo"]')).toHaveAttribute('aria-pressed', 'true');
});

test('adapts to dark mode and removes entrance motion when requested', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  await page.goto('./');
  const lightPage = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--page'));

  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  const darkPage = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--page'));
  const durationSeconds = await page.locator('.entrance').first().evaluate((node) => {
    const duration = getComputedStyle(node).animationDuration;
    return duration.endsWith('ms') ? Number.parseFloat(duration) / 1000 : Number.parseFloat(duration);
  });

  expect(darkPage.trim()).not.toBe(lightPage.trim());
  expect(durationSeconds).toBeLessThanOrEqual(0.00001);
});
