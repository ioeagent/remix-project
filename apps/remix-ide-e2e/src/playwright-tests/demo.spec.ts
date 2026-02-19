import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://127.0.0.1:8080/#lang=en&optimize&runs=200&evmVersion&version=soljson-v0.8.31+commit.fd3a2265.js');
  await page.getByRole('img', { name: 'cloudWorkspaces' }).click();
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  await page.locator('#cloudWorkspaces').click();
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByRole('button', { name: ' Continue with Google' })).toBeVisible();
});