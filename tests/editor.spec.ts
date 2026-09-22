import { expect, test } from '@playwright/test';

test('initial editor presents the complete starting controls', async ({ page }) => {
  await page.goto('./');

  await expect(page.getByRole('heading', { name: '把喜欢的照片，变成你的卡面' })).toBeVisible();
  await expect(page.getByRole('button', { name: '选择照片' })).toBeVisible();
  await expect(page.getByRole('button', { name: '完整标识' })).toBeVisible();
  await expect(page.getByRole('button', { name: '图形标识' })).toBeVisible();
  await expect(page.getByRole('button', { name: '导出 PNG' })).toBeDisabled();
});
