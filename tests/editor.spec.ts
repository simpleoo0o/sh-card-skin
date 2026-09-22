import { expect, test, type Page } from '@playwright/test';
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

async function setRange(page: Page, selector: string, value: string): Promise<void> {
  await page.locator(selector).evaluate((input, nextValue) => {
    const range = input as HTMLInputElement;
    range.value = nextValue;
    range.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

test('initial editor presents the complete starting controls', async ({ page }) => {
  await page.goto('./');

  await expect(page.getByRole('heading', { name: '把喜欢的照片，变成你的卡面' })).toBeVisible();
  await expect(page.getByRole('button', { name: '选择照片' })).toBeVisible();
  await expect(page.getByRole('button', { name: '完整标识' })).toBeVisible();
  await expect(page.getByRole('button', { name: '图形标识' })).toBeVisible();
  await expect(page.getByRole('button', { name: '导出 PNG' })).toBeDisabled();
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
  await setRange(page, '#angle-control', '45');

  await page.getByRole('button', { name: '完整标识' }).click();
  await expect(page.locator('[data-layer="logo"]')).toHaveAttribute('aria-pressed', 'true');
  await setRange(page, '#scale-control', '1.4');
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
