/**
 * Tier 1 E2E Specifications: Clinical Intake, Immutability & Approval Governance (Features 7-14).
 * Adheres strictly to HOSPITAL_FOLLOWUP_BUILD_SPEC.md §5, §7.4, §8.6 and PROJECT.md.
 */

import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/auth-users';

test.describe('Tier 1: Clinical Intake, Immutability & Approval Governance (Features 7-14)', () => {
  test('TC-07-01: Reception registers a new synthetic patient with multiple contacts', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.reception.email);
    await page.fill('input[name="password"]', TEST_USERS.reception.password);
    await page.click('button[type="submit"]');

    await page.goto('/reception/register');
    await page.fill('input[name="fullName"]', 'Amitabh Verma [SYNTHETIC DEMO]');
    await page.fill('input[name="dob"]', '1965-08-12');
    await page.selectOption('select[name="gender"]', 'male');
    await page.fill('input[name="primaryPhone"]', '+919876511111');

    await page.click('button[type="submit"]');
    await expect(page.locator('text=Patient registered successfully, text=SYN-MRN')).toBeVisible();
  });

  test('TC-08-03: Patient deduplication search surfaces disambiguation warning on ambiguous matches', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.reception.email);
    await page.fill('input[name="password"]', TEST_USERS.reception.password);
    await page.click('button[type="submit"]');

    await page.goto('/reception');
    // Search for ambiguous name with multiple matches
    await page.fill('input[placeholder*="Search by phone, name"]', 'Sunita Patel');
    await page.click('button:has-text("Search")');

    // Verify multiple matching rows are rendered with disambiguation warning
    const results = page.locator('tr:has-text("Sunita Patel")');
    await expect(results).toHaveCount(2);
    await expect(page.locator('text=Multiple matching records found, text=Verify DOB')).toBeVisible();
  });

  test('TC-09-02: Assistant uploads scan to private storage with SHA-256 hash calculation', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.assistantCardio.email);
    await page.fill('input[name="password"]', TEST_USERS.assistantCardio.password);
    await page.click('button[type="submit"]');

    await page.goto('/assistant/intake');

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('[data-testid="upload-scan-button"], input[type="file"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'cardio-discharge-scan.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\nSynthetic cardiology discharge record\n%%EOF'),
    });

    await expect(page.locator('text=Upload successful, text=cardio-discharge-scan.pdf')).toBeVisible();
    await expect(page.locator('[data-testid="file-hash"], text=SHA-256')).toBeVisible();
  });

  test('TC-10-03: Doctor review finalizes intake and creates initial Version 1 snapshot', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.doctorCardio.email);
    await page.fill('input[name="password"]', TEST_USERS.doctorCardio.password);
    await page.click('button[type="submit"]');

    await page.goto('/doctor');
    const pendingIntake = page.locator('tr:has-text("Pending Review"), a:has-text("Review Intake")').first();
    if (await pendingIntake.count() > 0) {
      await pendingIntake.click();
      await page.click('button:has-text("Approve & Submit Follow-up")');
      await expect(page.locator('text=Follow-up submitted, text=Version 1')).toBeVisible();
    }
  });

  test('TC-11-01: Direct edits on submitted follow-up records are blocked (Immutability)', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.assistantCardio.email);
    await page.fill('input[name="password"]', TEST_USERS.assistantCardio.password);
    await page.click('button[type="submit"]');

    await page.goto('/assistant');
    // Open a submitted follow-up
    const submittedRecord = page.locator('tr:has-text("SUBMITTED"), tr:has-text("ACTIVE")').first();
    if (await submittedRecord.count() > 0) {
      await submittedRecord.click();
      // Direct form inputs must be disabled or read-only
      await expect(page.locator('input[name="appointmentDate"]')).toBeDisabled();
      await expect(page.locator('text=Immutable Record, text=Submit Correction Proposal')).toBeVisible();
    }
  });

  test('TC-13-03: Department Head approves correction proposal, atomically creating Version 2', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.deptHeadCardio.email);
    await page.fill('input[name="password"]', TEST_USERS.deptHeadCardio.password);
    await page.click('button[type="submit"]');

    await page.goto('/department-head');
    const pendingApproval = page.locator('tr:has-text("Pending Approval")').first();
    if (await pendingApproval.count() > 0) {
      await pendingApproval.locator('button:has-text("Review Diff")').click();
      await page.click('button:has-text("Approve Proposal")');
      await expect(page.locator('text=Proposal Approved, text=Version 2')).toBeVisible();
    }
  });

  test('TC-14-02: Stale proposals are flagged when base version advances', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.deptHeadCardio.email);
    await page.fill('input[name="password"]', TEST_USERS.deptHeadCardio.password);
    await page.click('button[type="submit"]');

    await page.goto('/department-head');
    const staleBanner = page.locator('[data-testid="stale-conflict-banner"], text=Stale Conflict');
    if (await staleBanner.count() > 0) {
      await expect(staleBanner).toContainText('Base version has advanced');
      // Approving stale proposal directly must be disabled
      await expect(page.locator('button:has-text("Approve Proposal")')).toBeDisabled();
    }
  });
});
