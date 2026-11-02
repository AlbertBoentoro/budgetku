# Budgetku: staging-only browser tests

This is NOT a production fixture. Never import production financial rows into staging.

## Why this environment exists
The current Budgetku login is Google OAuth only. E2E tests therefore create a
**synthetic disposable user** via the staging Auth admin API, sign in via a
staging-only password, and pass the resulting session cookies to headless
Playwright. No real Google account is needed, and no production account is used.

The GitHub Actions workflow runs Next.js **locally on the runner**, rather
than testing a Vercel preview wired to the production Supabase project.
Everything the test creates must use its own Supabase staging project.

## Setup requirements

1. Create exactly one separate Free Supabase project, e.g. `budgetku-staging`
   in the user-approved organization, only if the quoted cost is zero.
   Note the NEW project ref and URL. Never use the production ref
   `zvmqrrttdrqkyrdzyxlf`.
2. Apply `tests/staging/schema-fixture.sql` to the empty staging project only.
   This creates a minimal app-compatible public schema, RLS policies and
   a private `budgetku-backups` Storage bucket. This is an isolated fixture,
   NOT a backup or full clone of the production schema.
   If testing recurring generation, apply the existing recurring RPC
   migration AFTER the base fixture (the current browser tests do not call it).
3. In GitHub repository > **Settings > Secrets and variables >
   Actions > Variables**, configure these PUBLIC **repository variables**
   (the test job does not start before both are present):
   - `STAGING_PROJECT_REF`: `omnzuolrlwczvnxrvenw`
   - `STAGING_SUPABASE_URL`: `https://omnzuolrlwczvnxrvenw.supabase.co`
   In **Settings > Environments**, create `budgetku-staging` and configure
   these **environment secrets** (never commit/paste them in chat):
   - `STAGING_SUPABASE_PUBLISHABLE_KEY`: *staging* publishable key
   - `STAGING_SUPABASE_SERVICE_ROLE_KEY`: *staging* server-side service-role
     key; only the GitHub Actions runner may use it. NEVER use a production key.
4. Push an approved change on `test/staging-playwright-20261102` after
   configuring those settings; GitHub Actions runs the staging E2E job
   automatically on the test branch, without merging to production. It
   rejects the production ref, unknown URLs, missing secrets and nonlocal app
   URLs before creating data. It installs Chromium, builds the real app,
   creates a temporary staging user, tests a transaction and backup, and
   cleans up. A workflow_dispatch control is also available once workflow
   configuration exists on the repository default branch.

## Safety and expected output

- Tests do NOT use the real Budgetku production URL; the app is served at
  `http://127.0.0.1:3000` with staging-only NEXT_PUBLIC values.
- A generated `@example.test` mailbox never receives email. The password
  is randomly generated for each run. Neither it nor tokens are logged.
- The service role must NEVER be made NEXT_PUBLIC or exposed to client code.
- Account balance starts at a synthetic Rp1.000.000. One Rp25.000 expense
  must create exactly one ledger row and produce Rp975.000 in arithmetic.
- Backup creation is checked through the authenticated app API and validated
  as a format-correct read-only snapshot. Cleanup removes test-only storage.
- A green CI result will validate THESE specific staging paths. It will not
  prove production SSO, Google OAuth, full restoration, or every screen.
- If cleanup fails, audit and remove only test-owned staging data; never run
  manual mass delete against production.
- GitHub Education includes enhanced Actions/Codespaces allocations for
  verified student accounts. The current default GitHub Actions runner works
  without installing any third-party paid tool.

## Release boundary
This is branch-only infrastructure. Do not merge the workflow or configure
production secret stores without a separate review. The user explicitly asked
for synthetic testing, not new production features or data changes.

## E2E run activation

Activated after GitHub staging environment variables and secrets were supplied by the repository owner. The test runs on the staging-only branch; it does not modify production code or call the production API.
