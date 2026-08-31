# Implementation Plan

Built in dependency order. Each phase keeps `npm run build` (typecheck) and `npm run lint`
green.

## Phase 1 — Scaffold
- `package.json`, `tsconfig.json` (strict), `next.config.ts`, Tailwind + PostCSS, ESLint.
- `lib/env.ts` (typed env access), `.env.example`.
- `lib/db/mongo.ts` (cached client), `lib/db/indexes.ts`.
- `components/ui/*` shadcn-style primitives (button, input, label, card, dialog, table,
  badge, textarea, select, toast).
- Root layout, global styles, landing → redirect to dashboard/login.

## Phase 2 — Auth
- `models/user.ts` (Zod + type), `repositories/userRepo.ts`.
- `lib/auth.ts` (NextAuth v5 config, Credentials provider, bcrypt verify).
- `app/api/auth/[...nextauth]/route.ts`, `middleware.ts` route guard.
- `(auth)/login`, `(auth)/register` pages + server actions; `services/authService.ts`.

## Phase 3 — Gmail OAuth
- `lib/crypto.ts` (AES-256-GCM encrypt/decrypt).
- `lib/google.ts` (OAuth2 client + Gmail client factory, token refresh).
- `models/gmailConnection.ts`, `repositories/gmailRepo.ts`, `services/gmailService.ts`.
- `app/api/gmail/connect/route.ts`, `app/api/gmail/callback/route.ts`, disconnect action.

## Phase 4 — Contacts
- `models/contact.ts`, `repositories/contactRepo.ts`, `services/contactService.ts`.
- `app/api/contacts` (GET list/search/paginate, POST create), `[id]` (PATCH/DELETE).
- Contacts page: table, search, create/edit dialog (RHF + Zod), tag input.

## Phase 5 — CSV import
- `lib/csv.ts` (papaparse wrapper, header mapping).
- `app/api/import` (POST parse-preview, POST commit) + `services/importService.ts`.
- Import UI: dropzone → preview table → confirm → bulk upsert.

## Phase 6 — Templates
- `models/template.ts`, `repositories/templateRepo.ts`, `services/templateService.ts`.
- `lib/template.ts` (`render(body, contact)` for `{{firstName}}`… + variable extraction).
- `app/api/templates` CRUD; Templates page with editor + live variable preview.

## Phase 7 — Composer
- TipTap editor component (`components/editor/RichEditor.tsx`).
- Compose page: To/CC/BCC chips, subject, body, preview, Test Send, Schedule, Save Draft.
- `app/api/send` → `services/emailService.enqueueSingle()`.

## Phase 8 — Campaigns
- `models/campaign.ts`, `repositories/campaignRepo.ts`, `services/campaignService.ts`.
- `models/emailJob.ts`, `repositories/emailJobRepo.ts`.
- Campaign wizard: name → template → contacts (filter by tag) → preview → launch.
- `app/api/campaigns` (POST launch, GET list). Enqueues one job per recipient; never sends inline.

## Phase 9 — Worker / Queue
- `worker/index.ts` main loop; `worker/processor.ts` single-job handler.
- `lib/rateLimit.ts` (token-bucket per connection).
- Atomic claim, template render, Gmail send, `gmailMessageId` store, retry/backoff, cap,
  campaign counter updates, audit log. `npm run worker` script.

## Phase 10 — History + Dashboard + Settings
- History page: jobs + campaigns with status filters (`GET /api/history`).
- Dashboard cards via Mongo aggregations (connected gmail, contacts, campaigns, sent today,
  failed, queue depth).
- Settings: profile, connected Gmail (connect/disconnect), danger zone.

## Phase 11 — Tests + polish
- Vitest: crypto round-trip, template render, CSV header mapping, Zod validators, worker
  claim/idempotency logic (with mongodb-memory-server or mocked repo).
- Final `npm run lint`, `npm run build`, `npm test`. README. Summary.
