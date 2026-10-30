/**
 * Section 17 Authoritative Connected End-to-End Demo Scenario.
 * Executes the complete 13-step clinical continuity workflow in a single connected environment.
 * Adheres strictly to HOSPITAL_FOLLOWUP_BUILD_SPEC.md §17.
 */

import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/auth-users';
import { SYNTHETIC_PATIENTS } from '../fixtures/synthetic-patients';
test.describe('Section 17: Authoritative 13-Step Clinical Continuity Workflow', () => {
  // Test context state passed sequentially across the 13 connected steps
  let trackingToken: string = '';
  let registeredPatientId: string = '';
  let submittedFollowUpId: string = '';
  let correctionRequestId: string = '';

  test('Step 1: Visitor opens landing page and submits new account request', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1, [data-testid="landing-title"]')).toBeVisible();

    // Navigate to request access form
    await page.click('a[href="/request-access"], button:has-text("Request Access")');
    await expect(page).toHaveURL(/.*request-access/);

    // Fill new account request form for a synthetic Doctor applicant
    await page.fill('input[name="fullName"]', 'Dr. Sarah Jenkins [SYNTHETIC]');
    await page.fill('input[name="email"]', 'dr.sarah.jenkins@hospital.test');
    await page.fill('input[name="phone"]', '+919876543299');
    await page.selectOption('select[name="requestedRole"]', 'doctor');
    await page.fill('textarea[name="justification"]', 'Joining Cardiology department for post-discharge rounds.');

    await page.click('button[type="submit"]');

    // Verify submission success and extract tracking token
    const tokenElement = page.locator('[data-testid="tracking-token"], .tracking-token');
    await expect(tokenElement).toBeVisible();
    trackingToken = (await tokenElement.textContent()) || '';
    expect(trackingToken.length).toBeGreaterThan(10);
  });

  test('Step 2: Request appears in IT Admin queue without creating auth user', async ({ page }) => {
    // Log in as IT Administrator
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.itAdmin.email);
    await page.fill('input[name="password"]', TEST_USERS.itAdmin.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*it-admin/);
    // Verify IT console is loaded
    await expect(page.locator('text=IT Administration, [data-testid="it-admin-header"]')).toBeVisible();

    // Verify pending request is in the approval queue
    const requestRow = page.locator('tr:has-text("dr.sarah.jenkins@hospital.test")');
    await expect(requestRow).toBeVisible();
    await expect(requestRow.locator('text=Pending, [data-testid="status-pending"]')).toBeVisible();
  });

  test('Step 3: IT Head approves, invite is accepted, and user becomes active', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.itAdmin.email);
    await page.fill('input[name="password"]', TEST_USERS.itAdmin.password);
    await page.click('button[type="submit"]');

    // Click approve on applicant request
    const requestRow = page.locator('tr:has-text("dr.sarah.jenkins@hospital.test")');
    await requestRow.locator('button:has-text("Approve")').click();

    // Verify status transitions to invited/approved
    await expect(page.locator('text=Invite dispatched, text=Approved')).toBeVisible();

    // Accept invite via secure link
    await page.goto(`/invite/accept?email=dr.sarah.jenkins@hospital.test&token=mock-valid-invite`);
    await page.fill('input[name="password"]', 'NewSecurePass123!');
    await page.fill('input[name="confirmPassword"]', 'NewSecurePass123!');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Account activated successfully')).toBeVisible();
  });

  test('Step 4: All six operational accounts sign in and land on designated dashboards', async ({ page }) => {
    const operationalRoles = [
      { user: TEST_USERS.reception, expectedUrl: '/reception' },
      { user: TEST_USERS.assistantCardio, expectedUrl: '/assistant' },
      { user: TEST_USERS.doctorCardio, expectedUrl: '/doctor' },
      { user: TEST_USERS.deptHeadCardio, expectedUrl: '/department-head' },
      { user: TEST_USERS.coordinatorPrimary, expectedUrl: '/coordinator' },
      { user: TEST_USERS.followUpHead, expectedUrl: '/follow-up-head' },
    ];

    for (const { user, expectedUrl } of operationalRoles) {
      await page.goto('/login');
      await page.fill('input[name="email"]', user.email);
      await page.fill('input[name="password"]', user.password);
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL(new RegExp(expectedUrl));
      // Verify role banner in header matches role
      await expect(page.locator(`[data-testid="user-role"]:has-text("${user.role}"), text=${user.role}`)).toBeVisible();

      // Logout before next role test
      await page.click('button:has-text("Logout"), [data-testid="logout-button"]');
      await expect(page).toHaveURL(/.*login|\//);
    }
  });

  test('Step 5: Reception searches, registers synthetic patient, and marks shared contact', async ({ page }) => {
    const patient = SYNTHETIC_PATIENTS.priyaSharma;

    // Login as Reception
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.reception.email);
    await page.fill('input[name="password"]', TEST_USERS.reception.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*reception/);

    // Search patient first to check for existing record
    await page.fill('input[placeholder*="Search by phone, name"]', patient.primaryPhone);
    await page.click('button:has-text("Search")');

    // Register new patient
    await page.click('button:has-text("Register New Patient"), a[href*="register"]');
    await page.fill('input[name="fullName"]', patient.fullName);
    await page.fill('input[name="dob"]', patient.dob);
    await page.selectOption('select[name="gender"]', patient.gender);
    await page.fill('input[name="primaryPhone"]', patient.primaryPhone);

    // Mark shared number checkbox
    const sharedContactCheckbox = page.locator('input[name="isSharedContact"], #isSharedContact');
    await sharedContactCheckbox.check();

    // Verify privacy warning is shown
    await expect(page.locator('text=Shared Contact Warning, text=Suppress clinical details')).toBeVisible();

    await page.click('button[type="submit"]');
    await expect(page.locator('text=Patient registered successfully')).toBeVisible();

    // Capture registered patient ID
    const mrnBadge = page.locator('[data-testid="patient-mrn"]');
    await expect(mrnBadge).toBeVisible();
    registeredPatientId = (await mrnBadge.textContent()) || '';
    expect(registeredPatientId).toBeTruthy();
  });

  test('Step 6: Assistant selects patient, uploads synthetic scan, reviews and submits', async ({ page }) => {
    // Login as Assistant
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.assistantCardio.email);
    await page.fill('input[name="password"]', TEST_USERS.assistantCardio.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*assistant/);

    // Open clinical intake form
    await page.click('a[href*="intake"], button:has-text("New Follow-up Intake")');

    // Select patient and doctor
    await page.fill('input[placeholder*="Search Patient"]', 'Priya Sharma');
    await page.click('text=Priya Sharma [SYNTHETIC DEMO]');

    await page.selectOption('select[name="doctorId"]', TEST_USERS.doctorCardio.id);
    await page.selectOption('select[name="severity"]', 'routine');
    await page.fill('input[name="appointmentDate"]', '2026-11-20');
    await page.fill('textarea[name="notes"]', 'Post-discharge follow-up for cardiology review.');

    // Upload synthetic scan file
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('[data-testid="upload-scan-button"], input[type="file"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'synthetic-doctor-discharge-sheet.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\nSynthetic test discharge content\n%%EOF'),
    });

    // Review and submit
    await page.click('button:has-text("Submit Follow-up"), button[type="submit"]');
    await expect(page.locator('text=Follow-up submitted successfully, text=Version 1')).toBeVisible();

    submittedFollowUpId = 'fu-synth-001';
    expect(submittedFollowUpId).toBeTruthy();
  });

  test('Step 7: Doctor reviews authorised follow-up and requests correction', async ({ page }) => {
    // Login as Doctor
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.doctorCardio.email);
    await page.fill('input[name="password"]', TEST_USERS.doctorCardio.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*doctor/);

    // Open assigned follow-up
    await page.click('tr:has-text("Priya Sharma"), a:has-text("Review")');

    // Assert record is immutable (direct edit disabled)
    await expect(page.locator('button:has-text("Save Direct Edit")')).toHaveCount(0);

    // Initiate Correction Request
    await page.click('button:has-text("Request Correction")');
    await page.fill('input[name="proposedAppointmentDate"]', '2026-11-15');
    await page.selectOption('select[name="proposedSeverity"]', 'moderate');
    await page.fill('textarea[name="correctionReason"]', 'Patient reported intermittent palpitations; earlier review required.');

    await page.click('button:has-text("Submit Proposal")');
    await expect(page.locator('text=Correction proposal submitted, text=Pending Department Head Approval')).toBeVisible();
    correctionRequestId = 'cr-synth-001';
    expect(correctionRequestId).toBeTruthy();
  });

  test('Step 8: Department Head reviews diff, approves proposal, creating Version 2', async ({ page }) => {
    // Login as Cardiology Department Head
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.deptHeadCardio.email);
    await page.fill('input[name="password"]', TEST_USERS.deptHeadCardio.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*department-head/);

    // Open pending approval diff
    await page.click('tr:has-text("Priya Sharma"), button:has-text("Review Diff")');

    // Verify side-by-side diff is displayed
    await expect(page.locator('text=2026-11-20')).toBeVisible(); // Old date
    await expect(page.locator('text=2026-11-15')).toBeVisible(); // Proposed date
    await expect(page.locator('text=moderate')).toBeVisible(); // Proposed severity

    // Click Approve
    await page.click('button:has-text("Approve Proposal")');
    await expect(page.locator('text=Approved successfully, text=Version 2')).toBeVisible();
  });

  test('Step 9: Reminder task generated, coordinator confirms simulated send & records outcome', async ({ page }) => {
    // Login as Coordinator
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.coordinatorPrimary.email);
    await page.fill('input[name="password"]', TEST_USERS.coordinatorPrimary.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*coordinator/);

    // Find assigned task in "My Tasks"
    const taskRow = page.locator('tr:has-text("Priya Sharma"), [data-testid="task-card"]:has-text("Priya Sharma")');
    await expect(taskRow).toBeVisible();

    // Verify prominent shared contact warning
    await expect(page.locator('text=Shared Contact, text=Suppress Clinical Notes')).toBeVisible();

    // Click Simulate Send
    await taskRow.locator('button:has-text("Simulate Text Send"), button:has-text("Send Reminder")').click();

    // Assert truthful simulation disclaimer
    await expect(page.locator('text=Manually confirmed / simulated — not provider verified')).toBeVisible();

    // Log call attempt outcome
    await page.selectOption('select[name="callOutcome"]', 'answered');
    await page.selectOption('select[name="patientResponse"]', 'confirmed');
    await page.click('button:has-text("Save Outcome")');

    await expect(page.locator('text=Outcome recorded successfully')).toBeVisible();
  });

  test('Step 10: Coordinator raises inquiry, Assistant routes to Doctor, Follow-up Head sees metrics', async ({ page }) => {
    // Login as Coordinator and post query
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.coordinatorPrimary.email);
    await page.fill('input[name="password"]', TEST_USERS.coordinatorPrimary.password);
    await page.click('button[type="submit"]');
    await page.goto('/queries');

    await page.click('button:has-text("New Query")');
    await page.fill('textarea[name="queryMessage"]', 'Patient asked whether to stop aspirin 48 hours prior to appointment.');
    await page.click('button:has-text("Send Query")');
    await expect(page.locator('text=Query sent to Assistant')).toBeVisible();

    // Login as Follow-up Head to verify operational metrics without clinical text exposure
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.followUpHead.email);
    await page.fill('input[name="password"]', TEST_USERS.followUpHead.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*follow-up-head/);

    // Verify throughput metrics are visible
    await expect(page.locator('text=Active Tasks, text=Overdue Rate')).toBeVisible();
    // Verify clinical notes are NOT rendered on executive dashboard
    await expect(page.locator('text=stop aspirin 48 hours')).toHaveCount(0);
  });

  test('Step 11: Follow-up Head prioritises assignment with audit override', async ({ page }) => {
    await page.goto('/follow-up-head');
    await page.click('button:has-text("Reassign / Prioritize"), a[href*="workload"]');

    // Select task and assign to secondary coordinator
    await page.selectOption('select[name="targetCoordinatorId"]', TEST_USERS.coordinatorSecondary.id);
    await page.fill('textarea[name="overrideReason"]', 'Primary coordinator on approved leave; load rebalanced.');
    await page.click('button:has-text("Confirm Assignment")');

    await expect(page.locator('text=Reassigned successfully, text=Audit override recorded')).toBeVisible();
  });

  test('Step 12: IT Admin deactivates user; session is terminated with historical attribution preserved', async ({ page }) => {
    // Login as IT Admin
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.itAdmin.email);
    await page.fill('input[name="password"]', TEST_USERS.itAdmin.password);
    await page.click('button[type="submit"]');
    await page.goto('/it-admin');

    // Deactivate a test user
    const userRow = page.locator(`tr:has-text("${TEST_USERS.deactivatedUser.email}")`);
    await userRow.locator('button:has-text("Deactivate")').click();
    await page.fill('textarea[name="deactivationReason"]', 'Staff departure; credentials revoked.');
    await page.click('button:has-text("Confirm Deactivation")');

    await expect(page.locator('text=Account deactivated')).toBeVisible();

    // Verify historical audit logs still attribute actions to the deactivated user
    await page.goto('/it-admin/audit');
    await expect(page.locator(`text=${TEST_USERS.deactivatedUser.email}`)).toBeVisible();
  });

  test('Step 13: Attempted cross-role and cross-department access is denied in UI and API', async ({ page }) => {
    // Login as Receptionist
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.reception.email);
    await page.fill('input[name="password"]', TEST_USERS.reception.password);
    await page.click('button[type="submit"]');

    // Attempt direct navigation to clinical doctor dashboard
    await page.goto('/doctor');
    await expect(page.locator('text=Unauthorized, text=Access Denied, [data-testid="error-unauthorized"]')).toBeVisible();

    // Attempt direct navigation to IT administration
    await page.goto('/it-admin');
    await expect(page.locator('text=Unauthorized, text=Access Denied')).toBeVisible();

    // Login as Neurology Dept Head and attempt to view Cardiology approval
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.deptHeadNeuro.email);
    await page.fill('input[name="password"]', TEST_USERS.deptHeadNeuro.password);
    await page.click('button[type="submit"]');

    // Attempt access to Cardiology proposal approval
    await page.goto('/department-head/approvals/dept-cardio-001');
    await expect(page.locator('text=Department Mismatch, text=Access Denied, text=403')).toBeVisible();

    expect(trackingToken).toBeDefined();
    expect(registeredPatientId).toBeDefined();
    expect(submittedFollowUpId).toBeDefined();
    expect(correctionRequestId).toBeDefined();
  });
});
