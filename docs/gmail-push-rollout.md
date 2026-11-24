# Gmail Push — staging rollout (Issue #64)

This is server-side Gmail notification, not a device notification. Email remains a draft; no transaction or balance is created automatically.

## Configure before enabling

1. Use the Google Cloud project that owns the Gmail OAuth client. Enable Gmail API and Cloud Pub/Sub API.
2. Create a topic, e.g. budgetku-gmail-staging. Grant Pub/Sub Publisher on that topic to gmail-api-push@system.gserviceaccount.com.
3. Create a dedicated service account for authenticated push; grant the Pub/Sub service agent the necessary ID-token permission. Create a push subscription with wrapped payload, HTTPS endpoint /api/gmail/push, authenticated with this service account and a fixed audience. Do not make the subscription unauthenticated. The preview endpoint must be externally reachable by Google; do not disable authentication on other app routes.
4. Apply docs/sql/2026-11-gmail-push-state.sql to STAGING ONLY; verify email_imports uniqueness before enabling. No destructive cleanup if duplicates exist.
5. Set server-side environment variables for staging only:
   - GMAIL_PUSH_TOPIC = projects/PROJECT/topics/TOPIC
   - GMAIL_PUSH_SUBSCRIPTION = projects/PROJECT/subscriptions/SUBSCRIPTION
   - GMAIL_PUSH_AUDIENCE = exact configured audience (normally HTTPS push endpoint URL)
   - GMAIL_PUSH_SERVICE_ACCOUNT = dedicated service account email
   - existing OAuth, encryption, Supabase service role, CRON_SECRET remain server-only.
6. Deploy preview and trigger GET /api/cron/gmail with Authorization: Bearer CRON_SECRET from a trusted server, never paste the secret into chat or browser URL. This registers existing Gmail connections and catches up. OAuth reconnect also attempts registration.
7. Send a test receipt to the staging mailbox, close app, then reopen and verify draft. Replay identical push; no duplicate. Check unauthorized JWT, wrong audience/account/subscription, expired cursor, revoked grants, race with manual sync, and connection changes. Confirm no transaction until approval.
8. Vercel cron runs daily at 09:00 WIB in the production deployment; preview cron is not assumed to run automatically. Trigger staging manually for validation. Keep environments, mailboxes, topic/subscription and secrets separate. Do not enable production until tests pass and user approves.

## Behavior and limitations

- Google sends mailbox history IDs, not the full email. The webhook verifies Google's token, service-account email, audience and subscription. The Gmail profile is verified against the connected address.
- Initial recovery uses the existing manual cursor with one-day overlap, or seven days if no cursor exists. Expired history recovers from last successful push sync. Cursor advances only after processing; duplicate insert is absorbed by the unique index.
- A bounded batch (500 IDs / 20 pages) fails closed on overflow. Large backlogs need a durable chunked recovery worker before rollout to larger inboxes. No silent cursor advance.
- A daily job renews the watch and reconciles missed messages. Visible transaction screen refreshes the DB list every 20 seconds while open; no Gmail polling in the browser.
- Manual sync remains. Same payment appearing in multiple provider emails still requires user review.
- No live Google Cloud credentials, staging migration, deployed preview or E2E verification performed by this PR alone.

References: https://developers.google.com/workspace/gmail/api/guides/push and https://cloud.google.com/pubsub/docs/authenticate-push-subscriptions
