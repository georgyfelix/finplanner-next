# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\tests\dashboard.spec.ts >> FinPlanner smoke tests >> create account, add categories, create transactions, copy planned
- Location: e2e\tests\dashboard.spec.ts:4:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3001/dashboard/accounts
Call log:
  - navigating to "http://localhost:3001/dashboard/accounts", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('FinPlanner smoke tests', () => {
  4  |   test('create account, add categories, create transactions, copy planned', async ({ page }) => {
  5  |     // NOTE: These tests assume a Clerk-authenticated session in the browser.
  6  |     const BASE = 'http://localhost:3001';
> 7  |     await page.goto(`${BASE}/dashboard/accounts`);
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3001/dashboard/accounts
  8  | 
  9  |     // Create account
  10 |     await page.fill('input[placeholder="Account name (e.g. Checking)"]', 'E2E Test Account');
  11 |     await page.fill('input[placeholder="Starting balance"]', '1500');
  12 |     await page.click('button:has-text("+ Add Account")');
  13 |     await expect(page.locator('text=E2E Test Account')).toBeVisible({ timeout: 5000 });
  14 | 
  15 |     // Ensure categories exist (GET will auto-create defaults)
  16 |     await page.goto(`${BASE}/dashboard/categories`);
  17 |     await expect(page.locator('text=Your Categories')).toBeVisible();
  18 | 
  19 |     // Add a custom income category if missing
  20 |     const salaryVisible = await page.locator('text=Salary').count();
  21 |     if (!salaryVisible) {
  22 |       await page.fill('input[placeholder="Category name"]', 'Salary');
  23 |       await page.selectOption('select', { label: '💰 Income' });
  24 |       await page.click('button:has-text("+ Add")');
  25 |     }
  26 | 
  27 |     // Create transactions
  28 |     await page.goto(`${BASE}/dashboard/transactions`);
  29 |     // Select account and category via selects
  30 |     await page.waitForSelector('select');
  31 |     await page.selectOption('select:nth-of-type(1)', { label: 'E2E Test Account' });
  32 |     // Create actual transaction: Salary
  33 |     await page.selectOption('select:nth-of-type(2)', { label: 'Salary' });
  34 |     await page.fill('input[type="number"]', '2000');
  35 |     await page.fill('input[type="date"]', '2026-05-01');
  36 |     await page.click('button:has-text("+ Add")');
  37 |     // Create expense
  38 |     await page.selectOption('select:nth-of-type(2)', { label: 'Food' });
  39 |     await page.fill('input[type="number"]', '45.5');
  40 |     await page.fill('input[type="date"]', '2026-05-03');
  41 |     await page.click('button:has-text("+ Add")');
  42 | 
  43 |     // Create planned transaction
  44 |     await page.check('input[type="checkbox"]');
  45 |     await page.selectOption('select:nth-of-type(2)', { label: 'Travel/Tickets' });
  46 |     await page.fill('input[type="number"]', '120');
  47 |     await page.fill('input[type="date"]', '2026-06-01');
  48 |     await page.click('button:has-text("+ Add")');
  49 |     await page.uncheck('input[type="checkbox"]');
  50 | 
  51 |     // Call copy endpoint for planned transaction via page context
  52 |     const planned = await page.evaluate(async (base) => {
  53 |       const res = await fetch(`${base}/api/transactions?month=6&year=2026`);
  54 |       const rows = await res.json();
  55 |       return rows.find((r: any) => r.isPlanned || r.origin === 'planned');
  56 |     }, BASE);
  57 |     test.expect(planned).toBeTruthy();
  58 | 
  59 |     const copyRes = await page.request.post(`${BASE}/api/transactions/copy`, { data: { transactionId: planned.id, numMonths: 3 } });
  60 |     expect(copyRes.ok()).toBeTruthy();
  61 |     const copyJson = await copyRes.json();
  62 |     expect(copyJson.copied).toBeGreaterThanOrEqual(0);
  63 | 
  64 |     // Verify copied transactions exist for next months
  65 |     const july = await page.request.get(`${BASE}/api/transactions?month=7&year=2026`);
  66 |     expect(july.ok()).toBeTruthy();
  67 |     const julyJson = await july.json();
  68 |     // At least one planned transaction should appear in July after copying
  69 |     const found = julyJson.some((r: any) => r.category === planned.category && r.isPlanned);
  70 |     expect(found).toBeTruthy();
  71 |   });
  72 | });
  73 | 
```