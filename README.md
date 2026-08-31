# Gmail Automation Platform

A private bulk-email tool: connect **multiple personal Gmail accounts** via Google OAuth,
import contacts, write templates, then press **Start**. A background worker rotates across
your Gmails and emails **every contact exactly once** — at your chosen pace and limits.

Prefer sending by hand? It also keeps a stack of **ready-to-send drafts** in each Gmail's
Drafts folder — send one yourself and it's logged, the contact is marked done, and replies
are tracked automatically.

Built with **Next.js 15 (App Router) · TypeScript (strict) · Tailwind + shadcn-style UI ·
MongoDB · NextAuth v5 · googleapis · Zod · TipTap · Vitest**.

> 📖 **New here? Follow [SETUP.md](SETUP.md)** — full local setup including every Google
> Cloud Console step.
> 🚀 **Already set up? [USAGE.md](USAGE.md)** — the one-page day-to-day cheat sheet.

## Features

- Email + password auth (bcrypt), route-guarded dashboard.
- **Multi-Gmail sending** via OAuth 2.0. Tokens encrypted at rest (AES-256-GCM).
  Each account has its own **send limit** and **pace** (e.g. 2 emails / 10s), with
  pause / reset / disconnect.
- **Simple Start / Stop** — Start emails everyone not yet contacted; Stop pauses; Start
  resumes exactly where it left off. **One email per contact, ever.**
- **Template drafts** — keeps N ready-to-send drafts (default 100) in each Gmail's Drafts
  folder, each addressed to a real contact. Send one by hand and it's recorded in History,
  the contact is marked emailed, and replies are tracked; delete it and the contact goes
  back in the queue. Contacts held by a draft are never double-sent by the auto-sender.
- Contacts CRUD with search, full pagination, **CSV/Excel import** (auto-detects Excel even
  if named `.csv`; preview before commit), and **lifecycle statuses** — Fresh · In draft ·
  Sent · Replied · Bounced · Unsubscribed, with click-to-filter counts.
- Templates with flexible `{{first name}}` variables (falls back to "there" when a contact
  has no name) and a live preview. Multiple templates → one picked at random per contact.
- Composer for one-off sends: To/Cc/Bcc, rich editor, preview, test send, scheduling.
- Background worker: Gmail rotation, per-account pacing + caps, retries/backoff,
  idempotency, and **reply detection** (headers only).
- **Analytics** charts (sends over time, status, per-Gmail usage, replies) and full
  **History** showing *From → To*, which template, and the rendered email.

## Quick start

```bash
npm install
cp .env.example .env    # fill in — see SETUP.md
```

Then either double-click **`start.bat`**, or run both of these:

```bash
npm run dev      # http://localhost:3000
npm run worker   # must run for emails to actually send
```

The app only **queues** emails — the **worker** delivers them. Both must be running.

## How sending works

```
Contacts ──Start──► one email queued per un-emailed contact
                        │
                        ▼
                    Worker  ── rotates across your Gmails
                        │      (each at its own pace, up to its own limit)
                        ▼
                   Gmail API ──► contact  ── marked "emailed" only once actually sent
```

- **Stop** holds the queue; **Start** resumes it. Nothing is lost.
- A contact is marked emailed **only when the email really goes out**, so "remaining"
  always reflects reality.
- If every Gmail hits its cap, the rest simply wait — reset a counter or connect another
  Gmail and they continue.

### …or send by hand, from Drafts

```
Contacts ──► draft created in your Gmail Drafts folder (contact reserved)
                        │
              you press Send in Gmail
                        │
                        ▼
   worker spots it ──► History + contact marked emailed + reply tracking
                        │
                        ▼
              a fresh draft takes its place
```

Delete a draft instead of sending it and its contact is released back into the queue. A
contact is either reserved by a draft **or** available to the auto-sender — never both, so
nobody is emailed twice.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start Next.js dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run worker` | Start the email-sending worker |
| `npm test` | Run the Vitest unit suite |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

## Project layout

```
app/            routes, pages, API handlers (App Router)
components/     UI primitives + feature components
lib/            infra: db, auth, crypto, google, mime, template, rate limit
services/       business logic + authorization
repositories/   MongoDB data access (one per collection)
models/         TypeScript types + Zod schemas
worker/         standalone queue processor + sender pool + reply checker
tests/          Vitest unit tests
```

See [SETUP.md](SETUP.md) for setup, and [architecture.md](architecture.md),
[database-schema.md](database-schema.md), [security-checklist.md](security-checklist.md)
for design details.

## Security notes

- Gmail is connected via OAuth only — **passwords are never stored**.
- Scopes are minimal: `gmail.send` (send), `gmail.compose` (manage the template drafts),
  and `gmail.metadata` (headers only, to detect replies and hand-sent drafts — it cannot
  read message contents).
- Refresh/access tokens are encrypted with AES-256-GCM before hitting the database.
- Every query is scoped to the authenticated user; all inputs validated with Zod.
- Nothing sends in an HTTP request — the worker sends with idempotency keys, per-account
  pacing/caps, and capped retries.
"# Auto-Email-Sender" 
