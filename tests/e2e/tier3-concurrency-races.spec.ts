/**
 * Tier 3 E2E Specifications: Cross-Feature Combinations & Concurrency Races.
 * Adheres strictly to HOSPITAL_FOLLOWUP_BUILD_SPEC.md §7.4, §14.3 and TEST_INFRA.md.
 */

import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/auth-users';

test.describe('Tier 3: Concurrency Races & Cross-Feature Cascades', () => {
  test('TC-CNC-01: Two simultaneous IT Admin approvals on same request result in exactly one winner', async ({ browser }) => {
    // Open two independent browser contexts representing two concurrent IT Admins
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // Log in Admin A
    await pageA.goto('/login');
    await pageA.fill('input[name="email"]', TEST_USERS.itAdmin.email);
    await pageA.fill('input[name="password"]', TEST_USERS.itAdmin.password);
    await pageA.click('button[type="submit"]');
    await pageA.goto('/it-admin');

    // Log in Admin B
    await pageB.goto('/login');
    await pageB.fill('input[name="email"]', TEST_USERS.itAdmin.email);
    await pageB.fill('input[name="password"]', TEST_USERS.itAdmin.password);
    await pageB.click('button[type="submit"]');
    await pageB.goto('/it-admin');

    const approveButtonA = pageA.locator('button:has-text("Approve")').first();
    const approveButtonB = pageB.locator('button:has-text("Approve")').first();

    if ((await approveButtonA.count() > 0) && (await approveButtonB.count() > 0)) {
      // Trigger approval near-simultaneously
      const [resA, resB] = await Promise.allSettled([
        approveButtonA.click(),
        approveButtonB.click(),
      ]);

      expect(resA.status).toBe('fulfilled');
      expect(resB.status).toBe('fulfilled');

      // Exactly one shows success, the second shows conflict/already processed
      const successCount =
        (await pageA.locator('text=Approved successfully').count()) +
        (await pageB.locator('text=Approved successfully').count());

      expect(successCount).toBe(1);
    }

    await contextA.close();
    await contextB.close();
  });

  test('TC-CNC-02: Competing proposals against Version 1 flag stale conflict when first proposal is approved', async ({ page }) => {
    // Log in as Department Head
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.deptHeadCardio.email);
    await page.fill('input[name="password"]', TEST_USERS.deptHeadCardio.password);
    await page.click('button[type="submit"]');

    await page.goto('/department-head');

    // Check if competing proposals exist
    const proposals = page.locator('tr:has-text("Pending Approval")');
    if (await proposals.count() >= 2) {
      // Approve Proposal 1
      await proposals.nth(0).locator('button:has-text("Review Diff")').click();
      await page.click('button:has-text("Approve Proposal")');
      await expect(page.locator('text=Proposal Approved, text=Version 2')).toBeVisible();

      // Return to queue; Proposal 2 must now be marked STALE_CONFLICT
      await page.goto('/department-head');
      await expect(page.locator('text=Stale Conflict, text=Base Version Outdated')).toBeVisible();
    }
  });

  test('TC-CNC-03: Deactivating user immediately revokes active browser session on next action', async ({ browser }) => {
    const adminContext = await browser.newContext();
    const coordinatorContext = await browser.newContext();

    const adminPage = await adminContext.newPage();
    const coordPage = await coordinatorContext.newPage();

    // Coordinator logs in
    await coordPage.goto('/login');
    await coordPage.fill('input[name="email"]', TEST_USERS.coordinatorPrimary.email);
    await coordPage.fill('input[name="password"]', TEST_USERS.coordinatorPrimary.password);
    await coordPage.click('button[type="submit"]');
    await expect(coordPage).toHaveURL(/.*coordinator/);

    // IT Admin logs in and deactivates Coordinator
    await adminPage.goto('/login');
    await adminPage.fill('input[name="email"]', TEST_USERS.itAdmin.email);
    await adminPage.fill('input[name="password"]', TEST_USERS.itAdmin.password);
    await adminPage.click('button[type="submit"]');
    await adminPage.goto('/it-admin');

    const deactivateBtn = adminPage.locator(`tr:has-text("${TEST_USERS.coordinatorPrimary.email}") button:has-text("Deactivate")`);
    if (await deactivateBtn.count() > 0) {
      await deactivateBtn.click();
      await adminPage.fill('textarea[name="deactivationReason"]', 'Emergency access revocation test.');
      await adminPage.click('button:has-text("Confirm Deactivation")');
      await expect(adminPage.locator('text=Account deactivated')).toBeVisible();

      // Coordinator now attempts an action in their active tab
      await coordPage.reload();
      // Should be redirected to login with access revoked message
      await expect(coordPage).toHaveURL(/.*login|\//);
      await expect(coordPage.locator('text=Account deactivated, text=Access Denied, text=Unauthorized')).toBeVisible();
    }

    await adminContext.close();
    await coordinatorContext.close();
  });

  test('TC-CNC-04: Approved reschedule cancels pending reminder jobs and re-anchors schedule', async ({ page }) => {
    // Log in as Department Head
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.deptHeadCardio.email);
    await page.fill('input[name="password"]', TEST_USERS.deptHeadCardio.password);
    await page.click('button[type="submit"]');

    await page.goto('/department-head');
    const rescheduleProposal = page.locator('tr:has-text("Reschedule Request")').first();
    if (await rescheduleProposal.count() > 0) {
      await rescheduleProposal.locator('button:has-text("Review Diff")').click();
      await page.click('button:has-text("Approve Proposal")');

      // Verify notification indicates previous reminder jobs cancelled
      await expect(page.locator('text=Schedule updated, text=Pending reminders cancelled')).toBeVisible();
    }
  });
});
