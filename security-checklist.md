# Security Checklist

## Authentication & sessions
- [x] App login via NextAuth Credentials; passwords hashed with **bcrypt** (never plaintext).
- [x] Sessions are JWT/cookie based; secret from `NEXTAUTH_SECRET`.
- [x] `(dashboard)` routes protected by `middleware.ts`; unauthenticated → `/login`.
- [x] NextAuth provides **CSRF** protection for auth POSTs.

## Gmail / OAuth
- [x] **OAuth 2.0 only** to connect Gmail — Gmail passwords are never requested or stored.
- [x] Minimal scope: `https://www.googleapis.com/auth/gmail.send`.
- [x] `access_type=offline` + `prompt=consent` to obtain a refresh token.
- [x] Refresh/access tokens encrypted at rest with **AES-256-GCM** (`TOKEN_ENCRYPTION_KEY`).
- [x] Tokens decrypted only in memory in the worker/service at send time.
- [x] Disconnect clears/marks the connection; revoke supported.

## Authorization
- [x] Every service method scopes queries by the authenticated `userId`.
- [x] Route handlers verify the session before acting; 401 otherwise.
- [x] Users can only read/mutate their own contacts, templates, campaigns, jobs.
- [x] `role` field supports future admin gating.

## Input validation
- [x] **Zod** schemas validate every API/body/query input at the boundary.
- [x] CSV rows validated per-row; malformed rows reported, not silently accepted.
- [x] Email addresses validated; ObjectId params validated before use.

## Secrets
- [x] All secrets in environment variables; `.env` git-ignored; only `.env.example` committed.
- [x] No secrets logged. Token ciphertext never returned to the client.
- [x] Server-only modules (`lib/db`, `lib/crypto`, `lib/google`) never imported by client components.

## Sending safety
- [x] Campaigns enqueue jobs; **never send a whole campaign in one HTTP request**.
- [x] **Idempotency key** per job prevents duplicate sends on retry/re-enqueue.
- [x] Worker rate-limits sends to respect Gmail quotas; capped retries with backoff.
- [x] Failures recorded (`lastError`, `failedCount`) for auditability.

## Data & audit
- [x] `auditLogs` records sensitive actions (connect/disconnect, campaign launch, sends).
- [x] Unique indexes prevent duplicate users and duplicate contacts per user.

## Operational
- [ ] Use HTTPS in production (deployment concern).
- [ ] Rotate `TOKEN_ENCRYPTION_KEY` / `NEXTAUTH_SECRET` via documented procedure.
- [ ] Configure Google OAuth consent screen + authorized redirect URIs per environment.
