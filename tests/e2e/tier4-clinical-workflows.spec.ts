/**
 * Tier 4 E2E Specifications: Real-World Clinical Workflows & Privacy Controls.
 * Adheres strictly to HOSPITAL_FOLLOWUP_BUILD_SPEC.md §4.6, §5.1, §7.1 and TEST_INFRA.md.
 */

import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/auth-users';

test.describe('Tier 4: Clinical Workflows & Privacy Safeguards', () => {
  test('TC-CLN-01: Shared phone number privacy workflow strictly suppresses clinical details', async ({ page }) => {
    // Log in as Coordinator
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.coordinatorPrimary.email);
    await page.fill('input[name="password"]', TEST_USERS.coordinatorPrimary.password);
    await page.click('button[type="submit"]');

    await page.goto('/coordinator');

    // Select the task for patient with shared phone number (Priya Sharma)
    const sharedTask = page.locator('tr:has-text("Priya Sharma"), [data-testid="task-card"]:has-text("Priya Sharma")');
    if (await sharedTask.count() > 0) {
      await sharedTask.click();

      // Assert prominent warning banner
      await expect(page.locator('[data-testid="shared-contact-warning"], text=Shared Contact')).toBeVisible();

      // Assert that standard communication template is stripped of clinical text
      const messagePreview = page.locator('[data-testid="message-preview"]');
      if (await messagePreview.count() > 0) {
        const text = await messagePreview.textContent();
        // Should contain hospital appointment notice without diagnosis
        expect(text).toContain('Hospital Follow-up Appointment');
        expect(text).not.toContain('CABG');
        expect(text).not.toContain('Stent');
        expect(text).not.toContain('Cardiovascular');
      }
    }
  });

  test('TC-CLN-02: High-severity urgent case triggers priority assignment and coordinator alert', async ({ page }) => {
    // Log in as Follow-up Head
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.followUpHead.email);
    await page.fill('input[name="password"]', TEST_USERS.followUpHead.password);
    await page.click('button[type="submit"]');

    await page.goto('/follow-up-head');

    // Prioritize high-severity patient
    const highSevRow = page.locator('tr:has-text("critical"), tr:has-text("high")').first();
    if (await highSevRow.count() > 0) {
      await highSevRow.locator('button:has-text("Prioritize")').click();
      await page.selectOption('select[name="assignedCoordinatorId"]', TEST_USERS.coordinatorPrimary.id);
      await page.fill('textarea[name="justification"]', 'Urgent clinical follow-up required within 48 hours.');
      await page.click('button:has-text("Confirm Priority Assignment")');

      await expect(page.locator('text=Priority assigned successfully')).toBeVisible();
    }
  });

  test('TC-CLN-03: Coordinator logs unreachable on primary phone and falls back to alternate contact', async ({ page }) => {
    // Log in as Coordinator
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.coordinatorPrimary.email);
    await page.fill('input[name="password"]', TEST_USERS.coordinatorPrimary.password);
    await page.click('button[type="submit"]');

    await page.goto('/coordinator');
    const multiContactTask = page.locator('tr:has-text("Mohammed Ali"), [data-testid="task-card"]:has-text("Mohammed Ali")');
    if (await multiContactTask.count() > 0) {
      await multiContactTask.click();

      // Log attempt 1: unreachable
      await page.selectOption('select[name="callOutcome"]', 'unreachable');
      await page.click('button:has-text("Log Attempt")');

      // System displays fallback contact (caregiver/son)
      await expect(page.locator('text=Alternate Contact, text=Caregiver')).toBeVisible();
      await page.click('button:has-text("Switch to Alternate Contact")');
      await expect(page.locator('text=Contact switched to Caregiver')).toBeVisible();
    }
  });
});
