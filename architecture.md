# Architecture

## Overview

A private, single-tenant-per-user Gmail automation platform. Users register with
email/password, connect a personal Gmail account via Google OAuth, manage contacts and
templates, and run email campaigns that are sent asynchronously through the Gmail API by a
background worker.

## High-level diagram

```
Browser (Next.js UI)
   │  server actions / fetch
   ▼
Next.js API routes & Server Actions  ──►  Services  ──►  Repositories  ──►  MongoDB
   │                                          │
   │ Google OAuth (connect Gmail)             │ enqueue emailJobs
   ▼                                          ▼
Google OAuth 2.0                        emailJobs collection
                                              ▲
                          Standalone Worker ──┘  claims jobs, sends via Gmail API
```

## Layers

| Layer          | Responsibility                                                        |
| -------------- | --------------------------------------------------------------------- |
| `app/`         | Routing, pages, server actions, API route handlers. Thin.             |
| `services/`    | Business logic, orchestration, authorization checks.                  |
| `repositories/`| Data access. One module per collection. Only place that touches Mongo.|
| `models/`      | TypeScript types + Zod schemas per collection.                        |
| `lib/`         | Cross-cutting infra: db client, auth, crypto, gmail, rate-limit.      |
| `worker/`      | Long-running Node process that drains the emailJobs queue.            |

**Golden rule:** pages/routes never touch Mongo directly — they call services, which call
repositories. Every service method receives the authenticated `userId` and scopes queries
to it.

## Request flows

### Auth
NextAuth (Auth.js v5) Credentials provider. `authorize()` looks up the user by email,
verifies bcrypt hash, returns a minimal session. Middleware guards `(dashboard)` routes.

### Connect Gmail
`/api/gmail/connect` builds a Google consent URL (scope `gmail.send`, `access_type=offline`,
`prompt=consent`). `/api/gmail/callback` exchanges the code, encrypts the refresh/access
tokens (AES-256-GCM), and upserts a `gmailConnections` doc keyed by `userId`.

### Send (single / test)
Composer → `/api/send` → `emailService.enqueueSingle()` creates one `emailJobs` doc
(status `queued`, optional `scheduledAt`). The worker picks it up. Test send enqueues a job
to the user's own address with high priority.

### Campaign
Wizard collects template + contact ids → `/api/campaigns` → `campaignService.launch()`
creates a `campaigns` doc and **one `emailJobs` doc per recipient** with a deterministic
`idempotencyKey` (`campaignId:recipientId`). No email is sent in the HTTP request.

### Worker
Loop: atomically claim due jobs (`findOneAndUpdate` status `queued`→`processing` where
`scheduledAt <= now`), render the template for the recipient, send via Gmail API, store
`gmailMessageId`, mark `sent`; on error, increment `attempts`, back off, or mark `failed`
after the cap. Campaign counters (`sentCount`/`failedCount`) are updated atomically.

## Key design decisions

- **MongoDB-backed queue** instead of BullMQ/Redis: fewer moving parts, runs on Windows,
  and the `emailJobs` schema already models a queue. Atomic claim via `findOneAndUpdate`.
- **AES-256-GCM** for token-at-rest encryption; key from `TOKEN_ENCRYPTION_KEY` env.
- **Idempotency keys** on jobs prevent double-sends on retry or duplicate enqueue.
- **Native Mongo driver** (not Mongoose) with a cached client to survive Next.js HMR.
- Rate limiting in the worker respects Gmail per-user sending limits.

## Tech stack

Next.js 15 (App Router) · TypeScript (strict) · Tailwind + shadcn-style UI · MongoDB
(native driver) · NextAuth v5 · googleapis · Zod · React Hook Form · Zustand · TipTap ·
Vitest. Worker runs via `tsx`.
