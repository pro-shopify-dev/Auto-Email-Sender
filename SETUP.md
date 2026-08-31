# Full Local Setup Guide

Everything needed to run this project on your own machine, start to finish.
Budget ~15 minutes. Everything here is **free** — no credit card.

---

## 0. What you need

| Requirement | Notes |
| --- | --- |
| **Node.js 20+** | https://nodejs.org (developed on Node 24) |
| **MongoDB** | Local (`mongodb://127.0.0.1:27017`) or a free MongoDB Atlas cluster |
| **A Google account** | To create the OAuth credentials |
| **The Gmail account(s) you'll send from** | Can be different from the Google account above |

---

## 1. Install dependencies

Open a terminal in the project folder:

```bash
npm install
```

---

## 2. MongoDB

**Option A — Local (simplest).** If MongoDB is already running on your PC, you're done; the
default `mongodb://127.0.0.1:27017` works.

**Option B — MongoDB Atlas (free).**
1. Create a free **M0** cluster at https://www.mongodb.com/atlas
2. **Database Access** → add a user (username + password)
3. **Network Access** → Add IP → *Allow access from anywhere* (`0.0.0.0/0`) for local dev
4. **Connect → Drivers** → copy the connection string
   (`mongodb+srv://user:pass@cluster.mongodb.net`)

---

## 3. Google Cloud Console — field-by-field

Go to **https://console.cloud.google.com** and sign in.

> Every screen below is listed with the **exact field name** on the left and **exactly what
> to enter** on the right. Anything not listed → leave at its default.

---

### 3.1 Create a project

Top bar → click the **project dropdown** (next to "Google Cloud") → **NEW PROJECT**.

| Field | What to enter |
| --- | --- |
| **Project name** | `Mail Sender` (any name) |
| **Location** / *Organization* | leave as **No organization** |

Click **CREATE**. Wait ~10s, then **select the new project** in the top bar.

> ⚠️ Everything below must happen **inside this project**. If the top bar shows a different
> project name, switch to yours first.

---

### 3.2 Enable the Gmail API

1. In the **top search bar**, type `Gmail API` → click the **Gmail API** result
2. Click the blue **ENABLE** button

✅ Done when the button changes to **MANAGE**. *(If it already says MANAGE, it's enabled.)*

---

### 3.3 OAuth consent screen (4 short screens)

Left menu → **Google Auth Platform** → **Overview** → click **GET STARTED**.
*(Older UI: **APIs & Services → OAuth consent screen**.)*

**Screen 1 — App Information**

| Field | What to enter |
| --- | --- |
| **App name** | `Mail Sender` (this is what you'll see on the consent screen) |
| **User support email** | click the dropdown → pick **your email** |

→ **NEXT**

**Screen 2 — Audience**

| Field | What to choose |
| --- | --- |
| **Internal** | ❌ Don't pick — requires a paid Google Workspace organization |
| **External** | ✅ **Pick this** — free, starts in *Testing* mode, no verification needed |

→ **NEXT**

**Screen 3 — Contact Information**

| Field | What to enter |
| --- | --- |
| **Email addresses** | your email (Google uses it for project notices) |

→ **NEXT**

**Screen 4 — Finish**

| Field | What to do |
| --- | --- |
| **I agree to the Google API Services: User Data Policy** | ✅ tick the checkbox |

→ **CONTINUE** → **CREATE**

---

### 3.4 Data Access — add the scopes

Left menu → **Data Access** → click **ADD OR REMOVE SCOPES**.

A panel slides in from the right with a filter + a table of scopes.

> 🔎 **The Gmail scopes will NOT be in that table.** The table only lists scopes for
> already-enabled APIs, and these are restricted. **Ignore the table** — scroll the panel
> all the way down to the **“Manually add scopes”** box.

| Field | What to enter |
| --- | --- |
| **Manually add scopes** (textarea at the bottom) | paste **both lines**: |

```
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.compose
https://www.googleapis.com/auth/gmail.metadata
```

Then:
1. Click **ADD TO TABLE** → they jump up into the table, ticked
2. Scroll down → click **UPDATE** (closes the panel)
3. Back on the Data Access page → click **SAVE**

✅ Done when you see them listed under **“Your sensitive scopes”** / **“Your restricted
scopes”**, like:

```
.../auth/gmail.send        Send email on your behalf
.../auth/gmail.compose     Manage drafts and send emails
.../auth/gmail.metadata    View your email message metadata when the message is open
```

| Scope | Why it's needed |
| --- | --- |
| `gmail.send` | Send email from your account |
| `gmail.compose` | Create and manage the **template drafts** that sit in your Drafts folder |
| `gmail.metadata` | Read message **headers only** to detect replies and spot drafts you sent by hand. It **cannot** read message contents. |

> ⚠️ **Upgrading an existing install?** `gmail.compose` is new. Add it here, then
> **reconnect every Gmail** in Settings — accounts connected before this was added did not
> grant it, and drafts will silently fail to appear until they do.

*"Sensitive/Restricted" sounds scary — it's normal and works fine in Testing mode.*

---

### 3.5 Audience → Test users ⚠️ (most-missed step)

Left menu → **Audience** → scroll to the **Test users** section → **+ ADD USERS**.

| Field | What to enter |
| --- | --- |
| **Add users** (text box) | **every Gmail you'll send from** — one per line |

Example:
```
tombillpore@gmail.com
mysecondaccount@gmail.com
mythirdaccount@gmail.com
```

→ **SAVE**

> If a Gmail is **not** on this list, Google blocks it with **"access denied"** when you try
> to connect it. Limit: **100** test users (free).

---

### 3.6 Clients → Create the OAuth client (your keys)

Left menu → **Clients** → click **+ CREATE CLIENT**.

| Field | What to enter |
| --- | --- |
| **Application type** | dropdown → select **Web application** ← *must be this* |
| **Name** | `Mail Sender Local` (internal label only — anything) |
| **Authorized JavaScript origins** | ⬅️ **LEAVE EMPTY** — don't add anything |
| **Authorized redirect URIs** | click **+ ADD URI**, then paste exactly: |

```
http://localhost:3000/api/gmail/callback
```

→ Click **CREATE**

#### Why JavaScript origins is empty

These two boxes look similar but do different jobs — **you only need the second one**:

| Box | Used for | This app? |
| --- | --- | --- |
| **Authorized JavaScript origins** | Browser-side OAuth (Google's JS SDK popup) | ❌ **Not used** — leave empty |
| **Authorized redirect URIs** | Server-side OAuth: where Google sends you back with `?code=` | ✅ **Required** |

This app redirects your browser to Google, and Google redirects back to the app's server
route `/api/gmail/callback` — no JavaScript SDK involved. *(If you ever do add an origin, it
must be **origin-only**: `http://localhost:3000` with **no path**, or Google errors with
"Invalid Origin: URI must not contain a path".)*

#### The redirect URI is the #1 thing people get wrong

It must be **character-for-character** identical:
- `http` — **not** `https` (it's localhost)
- `localhost:3000` — the port your app runs on
- ends with `/api/gmail/callback`
- **no trailing slash**, no spaces

It must equal `GOOGLE_REDIRECT_URI` in your `.env`. If they differ by even one character,
Google shows **`redirect_uri_mismatch`** when you click *Connect Gmail*.

| ✅ Correct | ❌ Wrong |
| --- | --- |
| `http://localhost:3000/api/gmail/callback` | `https://localhost:3000/api/gmail/callback` *(https)* |
| | `http://localhost:3000/api/gmail/callback/` *(trailing slash)* |
| | `http://localhost:3000` *(missing path)* |
| | `http://localhost:3001/api/gmail/callback` *(wrong port)* |

**The "OAuth client created" popup**

| Shown | What to do |
| --- | --- |
| **Client ID** (`5332...apps.googleusercontent.com`) | copy → `GOOGLE_CLIENT_ID` in `.env` |
| **Client secret** | ⚠️ *not always shown here* — click **DOWNLOAD JSON** to get it |

If you closed the popup: **Clients** → click your client's **name** → the **Client secret**
(`GOCSPX-...`) is on the right. You can also **Reset secret** there anytime.

The downloaded JSON contains both:
```json
{ "web": {
    "client_id":     "533....apps.googleusercontent.com",
    "client_secret": "GOCSPX-........"
} }
```

🔒 Keep the **Client secret** private — it's a password for your app. Never commit it.

---

## 4. Configure `.env`

Copy the example and fill it in:

```bash
cp .env.example .env
```

Generate the two secrets (works on Windows, no OpenSSL needed):

```bash
# NEXTAUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# TOKEN_ENCRYPTION_KEY  (must be 64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Where each value comes from:**

| `.env` variable | Where you get it | Looks like |
| --- | --- | --- |
| `MONGODB_URI` | local Mongo, or Atlas → Connect → Drivers | `mongodb://127.0.0.1:27017` |
| `MONGODB_DB` | anything | `gmail_automation` |
| `NEXTAUTH_SECRET` | the `base64` command above | `rDyxquqq...=` |
| `NEXTAUTH_URL` | fixed for local | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | §3.6 popup / downloaded JSON | `533...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | §3.6 downloaded JSON / Clients page | `GOCSPX-....` |
| `GOOGLE_REDIRECT_URI` | **must match §3.6 exactly** | `http://localhost:3000/api/gmail/callback` |
| `TOKEN_ENCRYPTION_KEY` | the `hex` command above (**64 chars**) | `91af6430...45` |

Your `.env` should look like:

```ini
MONGODB_URI="mongodb://127.0.0.1:27017"
MONGODB_DB="gmail_automation"

NEXTAUTH_SECRET="<paste the base64 value>"
NEXTAUTH_URL="http://localhost:3000"

GOOGLE_CLIENT_ID="....apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-...."
GOOGLE_REDIRECT_URI="http://localhost:3000/api/gmail/callback"

TOKEN_ENCRYPTION_KEY="<paste the 64-hex value>"
```

Leave the rest at their defaults (worker + per-Gmail limits below).

| Variable | Default | Meaning |
| --- | --- | --- |
| `GMAIL_DEFAULT_SEND_LIMIT` | `100` | Max emails **per Gmail** before it stops (0 = unlimited) |
| `GMAIL_DEFAULT_THROTTLE_PER_WINDOW` | `2` | Pacing: emails per window, per Gmail |
| `GMAIL_DEFAULT_THROTTLE_WINDOW_SECONDS` | `10` | → i.e. **2 emails / 10s** per Gmail |
| `WORKER_POLL_INTERVAL_MS` | `5000` | How often the worker checks the queue |
| `WORKER_REPLY_POLL_INTERVAL_MS` | `300000` | Reply check every 5 min |
| `GMAIL_DRAFT_POOL_ENABLED` | `true` | Keep ready-to-send drafts in each Gmail (`false` turns the feature off) |
| `GMAIL_DRAFT_POOL_SIZE` | `100` | How many drafts to keep **per Gmail** |
| `GMAIL_DRAFT_FILL_BATCH` | `25` | Max drafts created per account per minute (keeps the first fill gentle) |
| `WORKER_DRAFT_POLL_INTERVAL_MS` | `60000` | Top the drafts back up every 60s |

> `.env` is git-ignored — your secrets never get committed.

---

## 5. Run it

**Easiest:** double-click **`start.bat`**. It installs deps if needed, opens two windows
(**Web App** + **Worker**), and opens your browser.

**Manual equivalent** — two terminals:

```bash
npm run dev      # Terminal 1 — the site at http://localhost:3000
npm run worker   # Terminal 2 — sends the queued emails
```

⚠️ **Both must be running.** The site only *queues* emails; the **Worker** delivers them.

To stop: **`stop.bat`** (or close both windows).

---

## 6. First run — the actual flow

### 6.1 Register (app login — nothing to do with Google)

http://localhost:3000 → **Create one**

| Field | What to enter |
| --- | --- |
| **Name** | your name |
| **Email** | any email (just your login for this app) |
| **Password** | min 8 characters |

### 6.2 Connect a Gmail — every screen you'll see

**Settings → Connect Gmail**. Google then shows, in order:

| # | Screen | What to do |
| --- | --- | --- |
| 1 | **Choose an account** | Pick the Gmail you added as a **Test user** in §3.5 |
| 2 | **"Google hasn't verified this app"** | Click **Advanced** (small link, bottom-left) → then **Go to Mail Sender (unsafe)** |
| 3 | **"Mail Sender wants access to your Google Account"** | ✅ tick **every** permission (or **Select all**): <br>• *Send email on your behalf* <br>• *View your email message metadata…* <br>then **Continue** |
| 4 | Back in the app | Green toast: **"Gmail connected"** ✅ |

> **The "unsafe" warning is normal.** It appears because your app is in Testing mode and
> unverified by Google. It's *your own* app — it's safe. It cannot be avoided without
> submitting the app for Google verification.
>
> ⚠️ If you **untick** a permission on screen 3, sending or reply-tracking will fail.
> Tick them all.

**Repeat for each Gmail** you want to send from.

### 6.3 Set each Gmail's limit + pace

**Settings** → for each connected account → **Edit limits**:

| Field | Default | Meaning |
| --- | --- | --- |
| **Send limit (0 = ∞)** | `100` | stops this Gmail after N emails |
| **Emails per window** | `2` | ↓ together = **2 emails / 10 seconds** |
| **Window (seconds)** | `10` | |

Also here: **Pause**, **Reset** (clears the counter), **Disconnect**.

### 6.4 Contacts → Import
Upload your CSV/Excel. **Email is required**; name/phone/address optional. Preview shows
which columns were recognized (green) vs ignored (grey), then **Import**.

### 6.5 Templates → New template
Use `{{first name}}` for personalization — a contact with no name renders **"there"**
("Hi there,"). Variables also available: `{{last name}}`, `{{email}}`, `{{phone}}`,
`{{address}}`, `{{city}}`, `{{country}}`.

### 6.6 Sending → ▶ Start

| Button | What it does |
| --- | --- |
| **▶ Start** | Emails every contact **not yet contacted**. Safe to press again — never duplicates. |
| **■ Stop** | Pauses. Queued emails are **held, not lost**. |
| **▶ Start** (after Stop) | **Resumes exactly where it left off** |

Counters: **left to email · already sent · waiting in queue**.
Each contact is emailed **once, ever**.

### 6.7 Watch it
**History** → *From → To*, which template, status, replies, and **👁 View** the real email.
**Analytics** → charts + reply rate.

---

## 7. Template drafts — sending by hand

Alongside the automatic sending above, the app keeps a stack of **ready-to-send drafts**
waiting in each connected Gmail's **Drafts folder**. Open Gmail, read one, hit Send. That's
it — the app notices and does the bookkeeping for you.

Each draft is a **real email**: addressed to an actual contact, subject and body rendered
from one of your templates, greeting them by name (or **"there"** when you have no name).

**The cycle:**

| What happens | What the app does (within 60s) |
| --- | --- |
| A draft is **waiting** | Its contact is **reserved** — the auto-sender will never also email them |
| You **send it** from Gmail | Logs it to **History**, marks the contact emailed (never contacted again), counts it against that Gmail's limit, and starts **watching for a reply** |
| You **delete it** instead | That contact is **released** back into the queue — not wasted |
| Either way | A fresh draft is created to keep the pool at its target size |

**Settings → Template drafts** shows `100 / 100` per account and a **Refill now** button if
you don't want to wait for the next 60-second pass.

> ⏱️ **First fill takes a while.** It creates 25 drafts per account per minute, so 7 accounts
> × 100 drafts ≈ 30 minutes. This is deliberate — it keeps Gmail happy.

> 📌 **Drafts hold contacts.** 7 accounts × 100 drafts = **700 contacts reserved**, so your
> "Fresh" count drops by that much. They're not lost — they're waiting for you in Drafts.
> Lower `GMAIL_DRAFT_POOL_SIZE`, or set `GMAIL_DRAFT_POOL_ENABLED="false"`, if you'd rather
> keep them all in the automatic queue.

**You never get a double-send.** A contact is either reserved by a draft *or* available to
the auto-sender — never both.

---

## 8. Contact statuses

**Contacts** shows where every person stands, as a badge and as clickable filter chips:

```
All 5026 | Fresh 4851 | In draft 175 | Sent 0 | Replied 0 | Bounced 0 | Unsubscribed 0
```

| Badge | Meaning |
| --- | --- |
| ✨ **Fresh** | Never contacted — free to send to |
| 📄 **In draft** | Held by a draft waiting in your Gmail |
| ✉️ **Sent** | Emailed (automatically or by hand) — never emailed again |
| ↩️ **Replied** | They wrote back |
| **Bounced** / **Unsubscribed** | Excluded from sending |

The normal journey is **Fresh → In draft → Sent → Replied**. Counts always reflect your
whole list, not the current page. Click any chip to filter; click **All** to clear.

---

## 9. Limits worth knowing

| Limit | Value |
| --- | --- |
| Per-Gmail cap in this app | **100** by default → raise it or hit **Reset** in Settings |
| Total you can send | sum of all connected Gmails' limits |
| Gmail's own daily limit | ~**500/day** free Gmail · ~**2000/day** Workspace |
| Test users | 100 max |

If every Gmail hits its cap, remaining emails **wait in the queue** — nothing is lost.
Reset a counter or connect another Gmail and they resume.

---

## 10. Troubleshooting

| Problem | Fix |
| --- | --- |
| **"Access denied" / "app not verified"** when connecting | The Gmail isn't in **Audience → Test users**. Add it. The "unverified" warning itself is normal → Advanced → Continue. |
| **`redirect_uri_mismatch`** | The URI in Google **Clients** must be exactly `http://localhost:3000/api/gmail/callback` and match `GOOGLE_REDIRECT_URI`. |
| **"Google did not return a refresh token"** | Revoke at https://myaccount.google.com/permissions → remove the app → connect again. |
| **Every send fails with `invalid_grant` / accounts show "Revoked"** | The refresh tokens expired. **In "Testing" mode Google expires them after 7 days.** Fix now: **reconnect each Gmail** in Settings. Fix permanently: **publish the app to Production** (next row). |
| **Tokens keep dying every ~7 days** | Your OAuth app is stuck in **Testing**. Google Cloud → **Google Auth Platform → Audience → Publishing status → PUBLISH APP** → confirm. "In production" stops the 7-day expiry. It stays free; unverified just means users click *Advanced → Continue* once. No re-verification needed for personal use. |
| **Emails stay "queued", nothing sends** | The **Worker** window isn't running, or every Gmail hit its cap, or sending is **Stopped**. |
| **`ChunkLoadError` / `require is not defined` / weird 500s** | Stale build cache: `stop.bat` → delete the **`.next`** folder → `start.bat` → hard-refresh (**Ctrl+Shift+R**). |
| **Replies not showing** | The Gmail must be reconnected *after* the `gmail.metadata` scope was added. Reconnect it in Settings. |
| **No drafts appear in Gmail** | ① The **Worker** window must be running. ② You need at least **one template**. ③ Reconnect each Gmail so it grants `gmail.compose` (§3.4) — the worker logs `must be reconnected` when this is the cause. |
| **Drafts stuck below the target** | Normal during the first ~30 min (25/account/minute). Press **Settings → Template drafts → Refill now** to speed it up. |
| **A draft I sent isn't in History** | Give it 60s for the next pass. If it never appears, the account likely lacks `gmail.metadata` — reconnect it. |
| **"Fresh" count dropped a lot** | Expected — drafts reserve their contacts. See §7. Lower `GMAIL_DRAFT_POOL_SIZE` to reserve fewer. |
| **Changed a setting in `.env` and nothing happened** | The worker reads `.env` once at startup. `stop.bat` → `start.bat`. |
| **Dashboard says can't reach database** | MongoDB isn't running, or `MONGODB_URI` is wrong. |

---

## 11. Day-to-day use

Setup is a one-time thing. For everyday running — the two ways to send, reading contact
statuses, and common tasks — see the one-page **[USAGE.md](USAGE.md)** cheat sheet.

---

## 12. Handy commands

```bash
npm run dev        # web app
npm run worker     # email sender (must run to actually send)
npm test           # unit tests
npm run typecheck  # TypeScript check
npm run lint       # ESLint
```
