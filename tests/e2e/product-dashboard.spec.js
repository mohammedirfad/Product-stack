import { expect, test } from '@playwright/test';

test('admin can login and see protected product dashboard', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
  await expect(page.getByText('Total SKUs')).toBeVisible();
  await expect(page.getByRole('button', { name: /Add/i })).toBeVisible();
});
