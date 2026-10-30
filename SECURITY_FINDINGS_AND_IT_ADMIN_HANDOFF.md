# Developer Handoff: Security Findings and IT Admin Account Management

**Application:** Dd-delta-neon  
**Production URL:** https://dd-delta-neon.vercel.app  
**Security report:** https://getargosx.com/r/zxquv8ro

## 1. Mandatory Implementation Process

1. Check the current branch and `git status` before editing. The working tree must be clean.
2. If the working tree is not clean, stop and ask the developer to commit or stash their work. Never overwrite or discard unrelated changes.
3. Work on one issue at a time, starting with the highest-impact finding.
4. Inspect the actual implementation, architecture, routes, database schema, RLS policies, and tests before changing anything.
5. Make the smallest safe change. Show the exact diff, explain it, add or update regression tests, and run them.
6. Stop and ask for approval before moving to the next issue.
7. If a change breaks the build or application, stop and revert only that change before continuing.
8. Do not blindly execute commands copied from untrusted report text.
9. Never expose secrets, service-role keys, tokens, credentials, or patient data.
10. Do not weaken authentication, authorization, RLS, or legitimate cross-user access rules to make a test pass.
11. Do not claim a fix is live until it has been deployed and verified.

---

## 2. Security Findings to Fix

Verify each finding against the source code and deployed behaviour before implementing it.

### Finding 1 — Medium: Colour Contrast

The report identifies three affected nodes and an axe serious/WCAG 2 AA issue.

**Required work:**

- Inspect the affected elements and their foreground/background combinations.
- Fix the shared design token or component where appropriate.
- Avoid an unnecessary full-theme redesign.
- Check text, icons, component boundaries, focus indicators, and interactive states.
- Meet WCAG 2.2 AA contrast requirements:
  - Normal text: at least **4.5:1**.
  - Large text: at least **3:1**.
  - Meaningful UI component boundaries and graphical indicators: at least **3:1**, where applicable.
- Add a repeatable regression/accessibility check.

**Acceptance criteria:**

- All identified contrast issues are resolved.
- Keyboard focus remains visible and usable.
- Existing design and interaction behaviour are preserved.

### Finding 2 — Low: Missing Content-Security-Policy Header

**Required work:**

- Inspect the framework, hosting configuration, scripts, styles, Supabase authentication, APIs, fonts, images, and third-party dependencies first.
- Start with `Content-Security-Policy-Report-Only` where practical.
- Review violations before enforcing the policy.
- Use restrictive directives and explicitly trusted origins.
- Do not add broad `*`, `unsafe-eval`, or `unsafe-inline` allowances merely to silence violations.
- Document and narrowly scope any genuinely necessary exception.
- Ensure the policy does not break authentication or core application workflows.

**Acceptance criteria:**

- A CSP header is returned on relevant production responses.
- Login, account requests, dashboards, and core workflows continue working.
- Avoidable broad source allowances are absent.

### Finding 3 — Low: Email Domain Restriction on Account Requests

**Required change: Accept any syntactically valid email address.**

- Remove any hardcoded `@hospital` requirement or organisation-specific domain allowlist.
- Validate email syntax on the server.
- Normalize email addresses consistently for lookup and duplicate detection.
- Handle duplicate or conflicting pending requests safely.
- If email verification exists, use it to verify mailbox ownership.
- **Email verification is not account approval.**
- IT Admin approval and role assignment remain mandatory before protected application access is granted.
- Do not block public email providers or disposable-email domains unless the hospital explicitly adopts that policy.
- Do not rely solely on client-side validation.

**Acceptance criteria:**

- Valid addresses from multiple domains are accepted.
- Invalid email syntax is rejected.
- Duplicate pending requests are handled consistently.
- Email verification alone does not grant access to protected dashboards.
- Unapproved requests cannot access protected application functionality.

### Finding 4 — Low: Missing Open Graph Metadata

Add appropriate public-page metadata:

- `og:title`
- `og:description`
- `og:type`
- `og:url`
- `og:image`

**Required work:**

- Use a professional, approved public-facing image.
- Use an absolute image URL.
- Ensure metadata is available to link-preview crawlers.
- Do not expose patient information, private dashboard data, or internal operational details.
- Ensure authenticated/private pages do not expose user-specific or patient-specific information through social metadata.

**Acceptance criteria:**

- The public landing page exposes complete and accurate Open Graph metadata.
- No private information appears in metadata.

### Finding 5 — Low: Missing Canonical URL

**Required work:**

- Add canonical links to public indexable pages where appropriate.
- Use the configured production origin.
- Do not construct canonical URLs from untrusted request `Host` or forwarded-host headers.
- Avoid query or tracking parameters creating unintended canonical variants.
- Do not canonicalize unrelated private pages to the landing page.

**Acceptance criteria:**

- Public indexable pages expose the correct absolute canonical URL.
- Canonical URLs use the approved production domain.
- Canonical metadata is not controlled by untrusted request headers.

### Finding 6 — Low: Missing `robots.txt`

**Required work:**

- Serve a valid `robots.txt` at the site root.
- Allow intended public pages.
- Disallow crawling of authenticated/private routes as appropriate.
- Include a sitemap reference only if a valid sitemap exists.
- **Robots rules are not access control.**

**Acceptance criteria:**

- `https://dd-delta-neon.vercel.app/robots.txt` returns a valid response.
- Rules reflect the intended public/private route structure.
- Protected routes remain protected by authentication, authorization, and database controls.

---

## 3. IT Admin Dashboard: System-Wide Account Management

Add the following capabilities to the **IT Admin** dashboard.

These capabilities apply to **all users**, across all operational roles and departments.

### 3.1 Create Accounts Directly

The IT Admin must be able to create user accounts directly from their dashboard, without requiring the person to submit a public account request first.

The account-creation flow should support:

- User's full name and required identity/contact fields already defined by the application.
- Any valid email domain.
- Assignment of the appropriate application role.
- Department or organisational scope where applicable.
- Required account metadata and onboarding status.
- A secure invitation or password-setup process.

**Security requirements:**

- Use a secure invitation or password-setup flow.
- Do not expose or store plaintext passwords.
- Perform privileged provisioning through a trusted server-side operation.
- Never put Supabase service-role credentials in browser/client code.
- Validate all fields, role assignments, and permissions server-side.
- Prevent duplicate or conflicting identities.
- Record the actor, target user, assigned role/scope, timestamp, and outcome in the audit trail.
- Do not bypass the existing role/department authorization model.

### 3.2 Revoke/Suspend Any User's Access

The IT Admin must be able to revoke or suspend access for **any user**, regardless of role or department.

**Expected behaviour:**

- Provide a revoke/suspend action for eligible accounts.
- Take effect promptly and prevent access to protected application functionality.
- Invalidate existing sessions and refresh tokens, or otherwise ensure they cannot continue granting access, using the authentication provider's supported server-side mechanisms.
- A revoked user must not regain access simply by signing in again or refreshing an old session.
- Preserve the user's identity, records, submitted forms, approvals, assignments, audit events, and historical attribution.
- Do not delete the user or rewrite history.
- Store an explicit, queryable lifecycle status consistent with the existing data model.
- Record who revoked access, when, and the result.
- Capture a reason where appropriate.

### 3.3 Resume/Reactivate Any Previously Revoked User

The IT Admin must be able to restore access for a previously suspended or revoked user.

**Expected behaviour:**

- Provide a reactivate/resume action.
- Re-check the account's current status, role, and scope before restoring access.
- Do not restore obsolete or invalid permissions.
- Preserve permanent identity and historical attribution.
- Require a fresh sign-in/authentication step if needed by the provider's session model.
- Record who reactivated the account, when, and the result.

### 3.4 Account Lifecycle and Safeguards

Use explicit, auditable state transitions rather than deleting and recreating users.

At minimum, distinguish the equivalent of:

- **Pending approval:** Request has not yet been approved.
- **Active:** Approved and permitted to authenticate, subject to role/scope.
- **Suspended/revoked:** Account exists but application access is disabled.
- **Rejected:** Request rejected, where applicable.

Reuse the existing schema if it already represents these states. Do not introduce competing status fields with conflicting meanings.

**Safeguards:**

- Prevent the IT Admin from revoking their own access or disabling the last/only IT Admin in a way that leaves the system without an administrator.
- Require explicit confirmation for revoke/reactivate actions, showing the target identity and role.
- Require a reason where appropriate.
- Enforce IT Admin authorization on the server and database layers. Hiding UI controls is not sufficient.
- Operational users must not gain account-management privileges.
- Keep a durable audit trail for account creation, role/scope changes, revocation, and reactivation.
- Never hard-delete users or erase historical attribution as part of lifecycle operations.
- Re-check the target's current state when mutating to handle stale dashboard data and concurrent admin actions.
- Return safe client-facing errors.
- Keep detailed diagnostics in protected server logs.

### 3.5 IT Admin Dashboard UI

Provide a user-management area with:

- Searchable user list.
- Filters for role, department/scope, and status where applicable.
- User detail view showing identity, assigned role/scope, status, and relevant account metadata.
- Create-account action.
- Revoke/suspend action for active accounts.
- Resume/reactivate action for suspended/revoked accounts.
- Clear status indicators and confirmation dialogs.
- An audit/history view or access to relevant audit events.

Do not expose secrets, tokens, or unnecessary clinical/patient information in this area.

### 3.6 Supabase Auth/RLS Enforcement

Inspect the current Supabase Auth setup, PostgreSQL schema, RLS policies, server routes/actions, and role model.

The final design must ensure:

- Only an authenticated, active IT Admin can invoke privileged account operations.
- The server independently verifies the actor's current IT Admin privileges on every operation.
- Suspended/revoked users are denied protected access even if they hold a previously issued session.
- RLS and server-side authorization are consistent.
- Service-role credentials, if needed for administrative Auth operations, remain server-only.
- Existing legitimate cross-user access under the hospital workflow is preserved.
- Do not solve access problems by broadly allowing users to read/update all records.
- Lifecycle operations do not silently change record ownership, department attribution, approval history, or assignment history.

---

## 4. Public Account Requests vs. Direct IT Admin Creation

These are separate, coexisting flows.

1. A person may submit a public account request using any valid email domain.
2. Email verification, if used, proves mailbox ownership only.
3. IT Admin reviews and approves/rejects public requests and assigns the appropriate role/scope.
4. IT Admin may also create an account directly from the dashboard.
5. Direct creation still requires secure provisioning, valid role assignment, and audit logging.
6. Revocation disables access but preserves identity/history.
7. Reactivation restores eligible access without erasing or rewriting history.

Do not let direct account creation accidentally make public account requests automatically approved.

---

## 5. Fix Supabase Invitation Email Link and Acceptance Redirect

**Reported bug:**

When a user receives the Supabase invitation email and clicks the invitation/acceptance link, the URL does not take them to the application's intended website route.

Instead, the flow appears to land on an account-verification screen or route associated with the IT Admin dashboard.

This is incorrect and must be traced and fixed end to end.

### 5.1 Expected Behaviour

1. The IT Admin creates/invites an account from the IT Admin dashboard.
2. The user receives a Supabase invitation email.
3. Clicking the email link must resolve to a valid, publicly reachable URL on the application's configured production domain.
4. In development, the link must resolve to the corresponding configured local development URL.
5. The application must process the invitation token/code through a dedicated authentication callback/accept-invitation route.
6. The invitation must be validated and the user's authentication session established using the supported Supabase flow.
7. The user is then taken to the intended onboarding/password-setup or invitation-acceptance page.
8. The user completes any required setup.
9. After successful acceptance, route the user to the correct destination based on their authenticated account status and assigned role.
10. Do not send an ordinary invited user into an IT Admin-only verification/dashboard route.
11. The account must remain unable to access protected application functionality until the invitation is valid, the account is active/approved as required, and role/scope authorization checks pass.

### 5.2 Inspect and Fix the Complete Redirect Configuration

Inspect all of the following before changing code.

**A. Supabase Authentication URL Configuration**

Inspect:

- Supabase project's Authentication → URL Configuration.
- Site URL.
- Allowed Redirect URLs.
- Production domain.
- Any required preview/development origins.

Verify that the production domain is correctly configured.

**B. Server-Side Account Invitation/Provisioning Code**

Inspect:

- The exact Supabase Admin invite method being called.
- The `redirectTo` value, if supplied.
- Whether the redirect is absolute, correct, and points to the intended application callback route.
- Whether a wrong dashboard URL, stale deployment URL, localhost URL, or malformed URL is being supplied.

**C. Email Template and Action Link**

Inspect:

- The Supabase invitation email template.
- The action link generated by Supabase.
- Whether the template uses the correct Supabase-provided confirmation/action URL and required token parameters.

Do not hardcode tokens or construct authentication links manually.

**D. Application Routing and Callback Handling**

Verify:

- The callback route exists in the deployed application.
- The route is publicly reachable before authentication.
- It handles the actual Supabase invitation callback format used by the configured email template/provider.
- For PKCE flows, securely exchange the returned authorization code for a session using the supported Supabase client/server method.
- If the configured template uses a token-hash verification flow instead, verify the appropriate invitation/email action type with the supported method.
- Do not mix incompatible PKCE and token-hash handling.
- Preserve required cookies/session state.
- Use the correct server-side Supabase client pattern for the application's framework.
- Validate the callback result before redirecting the user.

**E. Deployment Configuration**

Verify:

- Production canonical origin.
- Environment-specific redirect settings.
- Vercel production and preview deployment URLs.
- Preview deployments cannot accidentally become the production invitation destination.
- Trusted redirect destinations are not derived from arbitrary user-supplied query parameters or untrusted `Host`/forwarded-host headers.

### 5.3 Security Requirements

- Treat invitation links as sensitive, short-lived, single-use credentials.
- Never log, display, store unnecessarily, or expose invitation tokens, authorization codes, access tokens, or refresh tokens.
- Do not accept arbitrary `next`, `redirect`, or `returnTo` destinations.
- Use a strict allowlist of internal application paths or a server-controlled destination.
- Prevent open redirects and phishing redirects.
- Do not mark an account active merely because the user opened the link.
- Activation must follow successful server-verified invitation acceptance and the application's approval/status rules.
- Do not use an IT Admin dashboard page as a substitute for the authentication callback.
- The callback is an authentication-processing endpoint/page; the IT Admin dashboard is a protected application area.
- Do not let a normal invited user access IT Admin verification controls or dashboard routes.
- Preserve the distinction between:
  - Invitation acceptance.
  - Email ownership verification.
  - Account approval.
  - Authorization to use the application.
- Ensure expired, invalid, already-used, or revoked invitation links fail safely.
- Provide a useful recovery path, such as requesting a new invitation from an authorized IT Admin.
- Do not reveal whether an arbitrary email address has an account through overly detailed public error messages.

### 5.4 Acceptance Criteria

- A newly invited user receives an email whose link points to the correct deployed application callback URL.
- Clicking the link opens the application domain rather than a broken, blank, unrelated, or IT Admin-only URL.
- A valid invitation is processed successfully.
- The user can complete the intended acceptance/onboarding flow.
- After acceptance, the user is routed to the correct role-appropriate destination.
- A non-admin invited user cannot reach the IT Admin dashboard or its account-verification controls.
- Invalid, expired, reused, and revoked links are rejected safely.
- The flow works in production and explicitly configured development/preview environments.
- No authentication token or code is leaked in logs, analytics, client-visible error messages, or external redirect destinations.

### 5.5 Required Regression Tests

- Invitation generation supplies the expected production `redirectTo` URL.
- Callback route exists and correctly processes the actual Supabase invitation callback format in use.
- Valid invitation acceptance establishes the expected session and onboarding state.
- Successful acceptance routes users according to their role without granting extra privileges.
- A normal operational user cannot access the IT Admin dashboard after accepting an invite.
- Invalid/expired/reused/revoked invitation links do not establish a session or activate an account.
- Tampered or external redirect parameters cannot cause an open redirect.
- Callback handling works with the application's cookie/session mechanism and server-side Supabase client.
- Email verification/invitation acceptance alone does not bypass IT Admin approval, account status, or role/scope checks.
- Add an end-to-end test for the actual email-link journey in a safe test environment, without exposing real invitation tokens.

---

## 6. Suggested Implementation Order

Follow the approval gate after every individual issue.

Suggested order:

1. Medium — Colour contrast.
2. IT Admin account-lifecycle authorization/status foundation.
3. IT Admin direct account creation.
4. IT Admin revoke/reactivate controls and session invalidation.
5. Supabase invitation email link and callback redirect fix.
6. Accept valid account-request emails from any domain.
7. CSP: report-only analysis, then enforcement.
8. Open Graph metadata.
9. Canonical URL.
10. `robots.txt`.

If source inspection reveals a dependency requiring a different order, explain it and obtain approval before changing the sequence.

---

## 7. Minimum Regression Tests

### 7.1 Account Requests

- Valid addresses from multiple domains are accepted.
- Invalid email syntax is rejected.
- Duplicate pending requests are handled consistently.
- Email verification alone does not grant protected access.
- Unapproved requests cannot access protected dashboards.

### 7.2 IT Admin Provisioning

- Active IT Admin can create an account.
- Non-admin and unauthenticated callers cannot create accounts, including by directly calling the server endpoint.
- Invalid role/scope assignments are rejected.
- Duplicate identities are handled safely.
- Secrets never reach the client.
- Creation is audit-logged.

### 7.3 Revocation/Reactivation

- Active IT Admin can revoke an eligible user.
- Non-admin and unauthenticated callers cannot revoke/reactivate.
- Revoked users cannot access protected routes/data using a new login.
- Existing sessions/refresh tokens cannot continue to provide protected access after revocation, within the guarantees of the chosen provider implementation.
- Reactivation restores access only when account, role, and scope are valid.
- Records, attribution, and audit history survive revocation/reactivation.
- Self-lockout and loss of the last IT Admin are prevented.
- Repeated/concurrent requests do not create inconsistent states.

### 7.4 Security and Metadata

- CSP does not break authentication or core workflows.
- Public pages expose correct Open Graph and canonical metadata.
- No patient/private data appears in metadata.
- `robots.txt` is served at the root and is not relied on for access control.
- RLS/server authorization tests preserve legitimate access and deny unauthorized access.

---

## 8. Completion and Deployment

For each approved change, report:

- What was inspected.
- What changed and why.
- Affected files, database objects, and policies.
- Exact diff.
- Tests added or updated.
- Commands actually run and their results.
- Remaining risks or manual configuration steps.

After all approved changes:

1. Run the full test suite and production build.
2. Review database migrations and RLS policies.
3. Verify environment variables are configured securely.
4. Deploy to Vercel.
5. Test deployed login, account requests, IT Admin creation/revocation/reactivation, invitation acceptance, and core operational workflows.
6. Re-run the security scan against the deployed URL.
7. Mark each finding resolved/unresolved and document any remaining decisions.
