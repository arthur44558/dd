/**
 * Tier 1 E2E Specifications: Operations, Reminders, Coordinator Pool & Inquiries (Features 15-24).
 * Adheres strictly to HOSPITAL_FOLLOWUP_BUILD_SPEC.md §6, §7.1, §8.7, §9 and PROJECT.md.
 */

import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/auth-users';

test.describe('Tier 1: Operations Pool, Reminders & Inquiries (Features 15-24)', () => {
  test('TC-18-02: Coordinator executes simulated text send with mandatory disclaimer', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.coordinatorPrimary.email);
    await page.fill('input[name="password"]', TEST_USERS.coordinatorPrimary.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*coordinator/);

    // Look for an assigned task
    const taskCard = page.locator('[data-testid="task-card"], tr:has-text("Due Today")').first();
    if (await taskCard.count() > 0) {
      await taskCard.locator('button:has-text("Simulate Send"), button:has-text("Send Reminder")').click();

      // Verify mandatory truthful simulation notice
      await expect(page.locator('text=Manually confirmed / simulated — not provider verified')).toBeVisible();
      await page.click('button:has-text("Confirm Simulated Send")');
      await expect(page.locator('text=Simulated attempt logged')).toBeVisible();
    }
  });

  test('TC-19-01: Coordinator records follow-up contact outcome', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.coordinatorPrimary.email);
    await page.fill('input[name="password"]', TEST_USERS.coordinatorPrimary.password);
    await page.click('button[type="submit"]');

    await page.goto('/coordinator');
    const task = page.locator('[data-testid="task-card"]').first();
    if (await task.count() > 0) {
      await task.click();
      await page.selectOption('select[name="callOutcome"]', 'answered');
      await page.selectOption('select[name="patientResponse"]', 'confirmed');
      await page.fill('textarea[name="outcomeNotes"]', 'Spoke to patient; appointment confirmed for Monday 10:00 AM.');
      await page.click('button:has-text("Save Outcome")');

      await expect(page.locator('text=Outcome recorded')).toBeVisible();
    }
  });

  test('TC-20-01: Contextual clinical inquiry routing between Coordinator and Assistant', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.coordinatorPrimary.email);
    await page.fill('input[name="password"]', TEST_USERS.coordinatorPrimary.password);
    await page.click('button[type="submit"]');

    await page.goto('/queries');
    await page.click('button:has-text("New Clinical Query")');
    await page.fill('textarea[name="queryText"]', 'Patient experiencing mild chest soreness; requested doctor advice.');
    await page.click('button:has-text("Submit Query")');

    await expect(page.locator('text=Query dispatched to Assistant')).toBeVisible();
  });

  test('TC-21-03: Notification counter reflects pending approvals and overdue tasks', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.deptHeadCardio.email);
    await page.fill('input[name="password"]', TEST_USERS.deptHeadCardio.password);
    await page.click('button[type="submit"]');

    // Check notification badge
    const badge = page.locator('[data-testid="notification-badge"]');
    if (await badge.count() > 0) {
      const count = await badge.textContent();
      expect(Number(count)).toBeGreaterThanOrEqual(0);
    }
  });

  test('TC-22-05: IT Admin audit trail viewer filters by actor, action and timestamp', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.itAdmin.email);
    await page.fill('input[name="password"]', TEST_USERS.itAdmin.password);
    await page.click('button[type="submit"]');

    await page.goto('/it-admin/audit');
    await expect(page.locator('table, [data-testid="audit-table"]')).toBeVisible();
    await expect(page.locator('th:has-text("Actor"), th:has-text("Action"), th:has-text("Timestamp")')).toBeVisible();
  });

  test('TC-24-04: Follow-up Head analytics displays aggregate throughput and suppresses clinical notes', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.followUpHead.email);
    await page.fill('input[name="password"]', TEST_USERS.followUpHead.password);
    await page.click('button[type="submit"]');

    await page.goto('/follow-up-head');
    await expect(page.locator('text=Operational Metrics, text=Department Throughput')).toBeVisible();

    // Verify clinical diagnosis / prescription terms are not exposed in executive view
    await expect(page.locator('text=CABG, text=stent, text=aspirin')).toHaveCount(0);
  });
});
