# Daily Use — Cheat Sheet

One page for running the thing day to day.
First-time install (Google Cloud, `.env`, Mongo) lives in **[SETUP.md](SETUP.md)**.

---

## Every session

1. Double-click **`start.bat`** → two windows open: **Web App** and **Worker**.
2. Go to **http://localhost:3000**.

> ⚠️ **The Worker window must stay open.** The website only *queues* emails and *tracks*
> drafts — the worker does the actual sending, draft topping-up, and reply checking. Close
> it and everything silently stops.

Stopping: **`stop.bat`**, or close both windows.

---

## The two ways to send

| | **Automatic** | **By hand (Drafts)** |
| --- | --- | --- |
| Where | **Sending** page → ▶ Start | Your Gmail's **Drafts** folder |
| Who sends | The worker, on a timer | You, clicking Send in Gmail |
| Pace | Each Gmail's limit + pace | However fast you like |
| Recorded in History | ✅ | ✅ (within 60s) |
| Replies tracked | ✅ | ✅ |

Both feed the same contact list and **neither will ever email the same person twice**.

---

## Automatic sending

**Sending** page:

| Button | Does |
| --- | --- |
| **▶ Start** | Emails everyone not yet contacted. Safe to press repeatedly — never duplicates. |
| **■ Stop** | Pauses. Queued emails are **held, not lost**. |
| **▶ Start** again | Resumes **exactly where it stopped**. |

Counters show **left to email · already sent · waiting in queue**.

---

## Sending by hand from Drafts

The app keeps **300 ready-to-send drafts per Gmail** (configurable), each already addressed
to a real contact with the template filled in and their name inserted.

**Just open Gmail → Drafts → pick one → Send.** Within 60 seconds the app will:
- log it in **History** (From → To → which template),
- mark that contact **Sent** so they're never emailed again,
- count it against that Gmail's send limit,
- start **watching the thread for a reply**,
- and create a **new draft** to replace it.

**Delete a draft** instead and that contact is released back into the queue — nothing wasted.

**Settings → Template drafts** shows `300 / 300` per account, plus **Refill now** if you
don't want to wait for the next 60-second pass.

> First fill takes ~30 min (25 per account per minute, on purpose).

---

## Reading contact statuses

**Contacts** page — click any chip to filter:

```
All 5026 | Fresh 4851 | In draft 175 | Sent 0 | Replied 0 | Bounced 0 | Unsubscribed 0
```

| Badge | Meaning |
| --- | --- |
| ✨ **Fresh** | Never contacted — free to send to |
| 📄 **In draft** | Sitting in a draft in your Gmail, waiting for you |
| ✉️ **Sent** | Emailed — will never be emailed again |
| ↩️ **Replied** | They wrote back |
| **Bounced** / **Unsubscribed** | Excluded from sending |

Normal journey: **Fresh → In draft → Sent → Replied**.

> "Fresh" looks low? Drafts *reserve* their contacts — 7 accounts × 300 drafts = 2100 held.
> They're waiting for you in Drafts, not lost.

---

## Common tasks

| I want to… | Do this |
| --- | --- |
| Add contacts | **Contacts → Import CSV** (Excel works too). Email required; name optional. |
| Change the message | **Templates**. Use `{{first name}}` — becomes "there" when there's no name. |
| Add another sending Gmail | **Settings → Connect Gmail** |
| Send slower / faster | **Settings → Edit limits** → emails per window + window seconds |
| Let a Gmail send more | **Settings → Edit limits** → raise **Send limit**, or hit **Reset** |
| Pause one Gmail only | **Settings → Pause** on that account |
| Fewer / more drafts | `.env` → `GMAIL_DRAFT_POOL_SIZE`, then restart |
| Turn drafts off entirely | `.env` → `GMAIL_DRAFT_POOL_ENABLED="false"`, then restart |
| See what was sent | **History** → **👁 View** shows the real email |
| See charts + reply rate | **Analytics** |
| **Start over completely** | **Settings → Danger zone → Start fresh** — marks every contact un-emailed, wipes History, resets counters. Contacts, templates and Gmails are kept. |

> Changed anything in `.env`? The worker reads it **once at startup** — restart it.

---

## When something looks wrong

| Symptom | Fix |
| --- | --- |
| Nothing sends | Worker window closed? Sending **Stopped**? All Gmails at their cap? Accounts show **"Revoked"**? (next row) |
| Accounts show **"Revoked"** / `invalid_grant` | Tokens expired — **reconnect each Gmail** in Settings. To stop it recurring every 7 days, **publish your OAuth app to Production** (see [SETUP.md §10](SETUP.md)). |
| No drafts appear | Worker running? At least one template? Each Gmail **reconnected** since `gmail.compose` was added? |
| A draft I sent isn't logged | Wait 60s for the next pass. Still missing → reconnect that Gmail. |
| Everything 500s / `ChunkLoadError` | `stop.bat` → delete the **`.next`** folder → `start.bat` → **Ctrl+Shift+R** |
| "Could not connect Gmail — Premature close" | Network/IPv6 issue on that machine. Retry; `start.bat` already forces IPv4. |

Fuller table: **[SETUP.md § 10 — Troubleshooting](SETUP.md)**.

---

## Limits to keep in mind

| Limit | Value |
| --- | --- |
| Per-Gmail cap in this app | **100** by default — raise or reset in Settings |
| Total capacity | sum of all connected Gmails' limits |
| Gmail's own daily limit | ~**500/day** free · ~**2000/day** Workspace |

If every Gmail hits its cap the rest just **wait** — reset a counter or connect another
Gmail and they resume.
