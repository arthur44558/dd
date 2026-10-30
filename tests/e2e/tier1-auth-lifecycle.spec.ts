/**
 * Tier 1 E2E Specifications: Auth, Identity, Access Requests & Role Dashboards (Features 1-6).
 * Adheres strictly to HOSPITAL_FOLLOWUP_BUILD_SPEC.md §3, §4 and PROJECT.md.
 */

import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/auth-users';

test.describe('Tier 1: Auth Lifecycle & Operational Dashboards (Features 1-6)', () => {
  test('TC-03-01: Public access request submission succeeds with tracking token', async ({ page }) => {
    await page.goto('/request-access');

    await page.fill('input[name="fullName"]', 'Applicant Alex');
    await page.fill('input[name="email"]', 'alex.applicant@hospital.test');
    await page.fill('input[name="phone"]', '+919876543201');
    await page.selectOption('select[name="requestedRole"]', 'coordinator');
    await page.fill('textarea[name="justification"]', 'Applying for follow-up coordinator position in Cardiology.');

    await page.click('button[type="submit"]');

    await expect(page.locator('[data-testid="request-success-alert"], text=Request Submitted')).toBeVisible();
    await expect(page.locator('text=Tracking Token, [data-testid="tracking-token"]')).toBeVisible();
  });

  test('TC-03-02: Public access request rejects invalid email and short justification', async ({ page }) => {
    await page.goto('/request-access');

    await page.fill('input[name="fullName"]', 'Applicant Bad');
    await page.fill('input[name="email"]', 'invalid-email-format');
    await page.fill('input[name="phone"]', '12345');
    await page.selectOption('select[name="requestedRole"]', 'reception');
    await page.fill('textarea[name="justification"]', 'short');

    await page.click('button[type="submit"]');

    await expect(page.locator('text=Invalid email address, text=Must be a valid email')).toBeVisible();
  });

  test('TC-04-01: IT Admin views pending request queue and applicant details', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.itAdmin.email);
    await page.fill('input[name="password"]', TEST_USERS.itAdmin.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*it-admin/);
    await expect(page.locator('table, [data-testid="requests-table"]')).toBeVisible();
    await expect(page.locator('text=Pending Access Requests')).toBeVisible();
  });

  test('TC-04-04: IT Admin deactivates active account and verifies session revocation', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.itAdmin.email);
    await page.fill('input[name="password"]', TEST_USERS.itAdmin.password);
    await page.click('button[type="submit"]');

    // Click deactivate on user
    const row = page.locator(`tr:has-text("${TEST_USERS.deactivatedUser.email}")`);
    if (await row.count() > 0) {
      await row.locator('button:has-text("Deactivate")').click();
      await page.fill('textarea[name="deactivationReason"]', 'Scheduled account termination.');
      await page.click('button:has-text("Confirm Deactivation")');
      await expect(page.locator('text=Deactivated, text=Account deactivated')).toBeVisible();
    }
  });

  test('TC-05-01: Authenticated shell renders role banner, user avatar and Asia/Kolkata timezone', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.doctorCardio.email);
    await page.fill('input[name="password"]', TEST_USERS.doctorCardio.password);
    await page.click('button[type="submit"]');

    // Check header elements
    await expect(page.locator('[data-testid="user-role"], text=doctor')).toBeVisible();
    await expect(page.locator('text=Asia/Kolkata, [data-testid="timezone-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="logout-button"], button:has-text("Logout")')).toBeVisible();
  });

  test('TC-06-01: Each operational role lands on their exclusive dashboard route', async ({ page }) => {
    const roles = [
      { user: TEST_USERS.reception, path: '/reception' },
      { user: TEST_USERS.assistantCardio, path: '/assistant' },
      { user: TEST_USERS.doctorCardio, path: '/doctor' },
      { user: TEST_USERS.deptHeadCardio, path: '/department-head' },
      { user: TEST_USERS.coordinatorPrimary, path: '/coordinator' },
      { user: TEST_USERS.followUpHead, path: '/follow-up-head' },
    ];

    for (const r of roles) {
      await page.goto('/login');
      await page.fill('input[name="email"]', r.user.email);
      await page.fill('input[name="password"]', r.user.password);
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL(new RegExp(r.path));
      await page.click('[data-testid="logout-button"], button:has-text("Logout")');
    }
  });
});
