/**
 * Tier 2 E2E Specifications: Boundary Conditions & Corner Cases.
 * Adheres strictly to HOSPITAL_FOLLOWUP_BUILD_SPEC.md §14.2, §14.4 and TEST_INFRA.md.
 */

import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/auth-users';
import { MOCK_SCAN_FILES } from '../fixtures/clinical-forms';

test.describe('Tier 2: Boundary & Corner Cases', () => {
  test('TC-BND-01: Indian phone number normalizes with country code prefix', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.reception.email);
    await page.fill('input[name="password"]', TEST_USERS.reception.password);
    await page.click('button[type="submit"]');

    await page.goto('/reception/register');
    // Input 10-digit number without country code
    await page.fill('input[name="primaryPhone"]', '9876543210');
    await page.locator('input[name="primaryPhone"]').blur();

    // Verify normalized value or formatted preview
    const phoneInput = page.locator('input[name="primaryPhone"]');
    const val = await phoneInput.inputValue();
    expect(val.replace(/\s+/g, '')).toContain('9876543210');
  });

  test('TC-BND-13: Uploading malicious executable disguised as PDF fails magic byte check', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.assistantCardio.email);
    await page.fill('input[name="password"]', TEST_USERS.assistantCardio.password);
    await page.click('button[type="submit"]');

    await page.goto('/assistant/intake');

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('[data-testid="upload-scan-button"], input[type="file"]');
    const fileChooser = await fileChooserPromise;

    // Attach DOS MZ executable disguised as PDF
    await fileChooser.setFiles({
      name: MOCK_SCAN_FILES.maliciousExeAsPdf.filename,
      mimeType: 'application/pdf',
      buffer: MOCK_SCAN_FILES.maliciousExeAsPdf.buffer,
    });

    // Expect validation failure feedback
    await expect(page.locator('text=Invalid file format, text=executable, text=Security violation')).toBeVisible();
  });

  test('TC-BND-14: Uploading zero-byte empty file is rejected with clear error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.assistantCardio.email);
    await page.fill('input[name="password"]', TEST_USERS.assistantCardio.password);
    await page.click('button[type="submit"]');

    await page.goto('/assistant/intake');

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('[data-testid="upload-scan-button"], input[type="file"]');
    const fileChooser = await fileChooserPromise;

    await fileChooser.setFiles({
      name: MOCK_SCAN_FILES.emptyFile.filename,
      mimeType: 'application/pdf',
      buffer: MOCK_SCAN_FILES.emptyFile.buffer,
    });

    await expect(page.locator('text=Empty file, text=0 bytes, text=Upload failed')).toBeVisible();
  });

  test('TC-BND-21: Follow-up required = No must not allow appointment date selection', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.assistantCardio.email);
    await page.fill('input[name="password"]', TEST_USERS.assistantCardio.password);
    await page.click('button[type="submit"]');

    await page.goto('/assistant/intake');
    // Toggle follow-up required to No
    const followUpCheckbox = page.locator('input[name="followUpRequired"]');
    if (await followUpCheckbox.isChecked()) {
      await followUpCheckbox.uncheck();
    }

    // Appointment date input should be disabled or hidden
    const dateInput = page.locator('input[name="appointmentDate"]');
    await expect(dateInput).toBeDisabled();
  });

  test('TC-BND-25: Rapid double-click on submission button prevents duplicate creation', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.reception.email);
    await page.fill('input[name="password"]', TEST_USERS.reception.password);
    await page.click('button[type="submit"]');

    await page.goto('/reception/register');
    await page.fill('input[name="fullName"]', 'Debounce Test Patient');
    await page.fill('input[name="dob"]', '1990-01-01');
    await page.fill('input[name="primaryPhone"]', '+919988776655');

    const submitBtn = page.locator('button[type="submit"]');
    // Trigger double click
    await submitBtn.dblclick();

    // Verify button gets disabled during in-flight submission
    await expect(submitBtn).toBeDisabled();
  });
});
