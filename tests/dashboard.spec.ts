import { expect, test } from '@playwright/test';

test('opens all three metrics and the weekly chart from the host view', async ({ page }) => {
  await page.goto('/');
  const active = page.getByTestId('metric-active-players');
  const held = page.getByTestId('metric-sessions-held');
  const attendance = page.getByTestId('metric-no-shows');
  await expect(active).toHaveAccessibleName('Active players: 93. View details');
  await expect(held).toHaveAccessibleName('Sessions held: 20. View details');
  await expect(attendance).toHaveAccessibleName('Recorded no-shows: 15. View details');
  await expect(page.getByTestId('weekly-chart')).toBeVisible();

  for (const [metric, name] of [[active, 'Active players'], [held, 'Sessions held'], [attendance, 'Recorded no-shows']] as const) {
    await metric.click();
    const details = page.getByTestId('metric-details');
    await expect(details).toBeFocused();
    await expect(details.getByRole('table', { name: `${name} in the selected period` })).toBeVisible();
  }
});

test('switches to the new club and can return without losing the dashboard', async ({ page }) => {
  await page.goto('/');
  const club = page.getByTestId('club-switcher');
  await expect(page.getByTestId('weekly-chart')).toBeVisible();
  await club.selectOption('club-002');
  await expect(page.getByTestId('empty-club')).toBeVisible();
  await expect(page.getByTestId('weekly-chart')).not.toBeVisible();
  await club.selectOption('club-001');
  await expect(page.getByTestId('weekly-chart')).toBeVisible();
  await expect(page.getByTestId('empty-club')).not.toBeVisible();
});

test('applies a custom range and keeps incomplete attendance visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('weekly-chart')).toBeVisible();
  await page.getByTestId('date-from').fill('2026-09-28');
  await page.getByTestId('date-to').fill('2026-10-04');
  await page.getByTestId('range-apply').click();
  await expect(page.getByTestId('metric-sessions-held')).toHaveAccessibleName('Sessions held: 5. View details');
  await expect(page.getByTestId('metric-no-shows')).toHaveAccessibleName('Recorded no-shows: 2. View details');
  await expect(page.getByTestId('metric-no-shows')).toContainText(/partial|2\s*(?:of|\/)\s*5/i);
});

test('reapplying the current range keeps the dashboard visible without refetching', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('weekly-chart')).toBeVisible();
  const requests: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/api/insights?')) requests.push(request.url());
  });
  await page.getByTestId('range-apply').click();
  await expect(page.getByTestId('metric-sessions-held')).toHaveAccessibleName('Sessions held: 20. View details');
  await page.getByRole('button', { name: 'Last 4 full weeks' }).click();
  await expect(page.getByTestId('weekly-chart')).toBeVisible();
  expect(requests).toEqual([]);
});

test('distinguishes unknown no-shows from a recorded zero on screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('weekly-chart')).toBeVisible();
  await page.getByTestId('date-from').fill('2026-09-28');
  await page.getByTestId('date-to').fill('2026-09-28');
  await page.getByTestId('range-apply').click();
  await expect(page.getByTestId('metric-no-shows')).toContainText('Unknown');
  await expect(page.getByTestId('metric-no-shows')).toHaveAccessibleName('Recorded no-shows: —. View details');
  await page.getByTestId('date-from').fill('2026-09-10');
  await page.getByTestId('date-to').fill('2026-09-10');
  await page.getByTestId('range-apply').click();
  await expect(page.getByTestId('metric-no-shows')).toHaveAccessibleName('Recorded no-shows: 0. View details');
});

test('keeps the viewport free of page-level overflow', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('weekly-chart')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('serves the reusable JSON contract and validates bad requests', async ({ request }) => {
  const clubs = await request.get('/api/clubs');
  expect(clubs.ok()).toBeTruthy();
  expect((await clubs.json()).clubs.map((club: { id: string }) => club.id)).toEqual(['club-001', 'club-002']);

  const valid = await request.get('/api/insights?clubId=club-001&from=2026-09-28&to=2026-10-04');
  expect(valid.ok()).toBeTruthy();
  expect(await valid.json()).toMatchObject({
    range: { previousFrom: '2026-09-21', previousTo: '2026-09-27' },
    current: { sessionsHeld: 5, noShows: 2, attendance: { eligibleSessions: 5, recordedSessions: 2, status: 'partial' } },
    weekly: [{ weekStart: '2026-09-28', sessionsHeld: 5 }],
  });
  expect((await request.get('/api/insights?clubId=club-001&from=2026-09-31')).status()).toBe(400);
  expect((await request.get('/api/insights?clubId=not-a-club')).status()).toBe(404);
});
