# Budgetku P0 - Offsite backup rollout gate (2026-11-15)

**Status: ENCRYPTION CORE ONLY. OFFSITE BACKUP NOT ENABLED.**
This branch does not upload to any provider, touch production data, modify balances, schedule backups, or delete snapshots. The server-only core uses AES-256-GCM and an immutable upload/readback contract. Synthetic in-memory tests are not proof of remote recovery.

## Provider choice and key custody
Choose a private, independent offsite destination (separate Cloudflare R2/S3 account or dedicated Google Drive service account). Store its credentials ONLY in deployment secret managers, not code, logs, PRs, messages, or NEXT_PUBLIC_ variables. Generate a separate random 32-byte encryption key, and preserve its recovery copy outside both storage accounts. Loss of this key makes encrypted backups unrecoverable.

## Steps before activation
1. Choose provider, separate account, private bucket/folder, permissions, costs, and owner.
2. Implement a provider-specific immutable create-if-absent adapter and authenticated readback. Never use publicly accessible objects or overwrite historical snapshots.
3. On staging, create a validated synthetic backup, encrypt the exact verified bytes, upload and download, decrypt, compare SHA-256 and plaintext byte-for-byte.
4. Test upload failure, wrong key, tampered content, retry, stale/outage conditions, and restore to a fully isolated staging project with separate auth identities.
5. Add alerts for incomplete or failed replication; report same-project backup success separately from offsite success.
6. Only after independently verified restore should retention be evaluated by dry run. Never delete the last working backup, the newest backup, unreplicated snapshots, or manual/pre-restore safety backups.

## Scope and security
- The provider-neutral core is in lib/settings/offsite-backup-core.mjs; the sample storage adapter in tests is in-memory only.
- It authenticates a validated user ID and snapshot filename with AES-GCM Additional Authenticated Data.
- Always run the existing inspectBackupJson owner/schema validation before encryption when integrating a real uploader.
- Offsite restoration must explicitly cover account/Auth ID mapping and cannot be equated with insert-only transaction recovery.
- Do not run automatic backup retention until actual offsite recovery succeeds.

## Release blocker
No independent provider or credentials have been selected and tested. This branch is an audited building block, NOT an active offsite backup service.
