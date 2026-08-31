/**
 * Typed, lazily-validated access to environment variables.
 *
 * We intentionally do NOT throw at import time — the app should still boot (and pages
 * render) with placeholder env during development. Instead, each getter throws a clear
 * error only when a feature that genuinely needs the value is exercised.
 */

function optional(name: string, fallback = ""): string {
  const raw = process.env[name] ?? fallback;
  // Allow quoted values in .env (e.g. "60000" or 'true'). Trim surrounding quotes and whitespace.
  const trimmed = typeof raw === "string" ? raw.trim().replace(/^['"]|['"]$/g, "") : raw;
  return String(trimmed);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

export const env = {
  get mongoUri() {
    return required("MONGODB_URI");
  },
  get mongoDb() {
    return optional("MONGODB_DB", "gmail_automation");
  },
  get nextAuthSecret() {
    return required("NEXTAUTH_SECRET");
  },
  get googleClientId() {
    return required("GOOGLE_CLIENT_ID");
  },
  get googleClientSecret() {
    return required("GOOGLE_CLIENT_SECRET");
  },
  get googleRedirectUri() {
    return optional(
      "GOOGLE_REDIRECT_URI",
      "http://localhost:3000/api/gmail/callback",
    );
  },
  get tokenEncryptionKey() {
    return required("TOKEN_ENCRYPTION_KEY");
  },
  get workerRatePerMinute() {
    return Number(optional("WORKER_RATE_PER_MINUTE", "30"));
  },
  get workerPollIntervalMs() {
    return Number(optional("WORKER_POLL_INTERVAL_MS", "5000"));
  },
  get workerBatchSize() {
    return Number(optional("WORKER_BATCH_SIZE", "10"));
  },

  // ---- Per-Gmail sending defaults (applied to each newly connected account) ----
  /** Max emails a single Gmail may send before it stops (0 = unlimited). */
  get gmailDefaultSendLimit() {
    return Number(optional("GMAIL_DEFAULT_SEND_LIMIT", "100"));
  },
  /** Pacing: up to N emails per window, per Gmail. */
  get gmailDefaultThrottlePerWindow() {
    return Number(optional("GMAIL_DEFAULT_THROTTLE_PER_WINDOW", "2"));
  },
  /** Pacing window length in seconds, per Gmail (e.g. 2 per 10s). */
  get gmailDefaultThrottleWindowSeconds() {
    return Number(optional("GMAIL_DEFAULT_THROTTLE_WINDOW_SECONDS", "10"));
  },

  // ---- Draft pool (keep N template-only drafts sitting in each Gmail's Drafts folder) ----
  /** Whether the worker keeps a pool of template drafts in each connected Gmail. */
  get draftPoolEnabled() {
    return optional("GMAIL_DRAFT_POOL_ENABLED", "true") !== "false";
  },
  /** How many ready-to-send drafts to keep per connected Gmail. */
  get draftPoolSize() {
    return Number(optional("GMAIL_DRAFT_POOL_SIZE", "300"));
  },
  /** Cap on drafts created per account per pass, so the first fill doesn't hammer Gmail. */
  get draftFillBatch() {
    return Number(optional("GMAIL_DRAFT_FILL_BATCH", "300"));
  },
  /** How often the worker reconciles each account's draft pool (ms). */
  get workerDraftPollIntervalMs() {
    return Number(optional("WORKER_DRAFT_POLL_INTERVAL_MS", "60000")); // 1 min
  },

  // ---- Reply tracking (worker polls sent threads for replies) ----
  get workerReplyPollIntervalMs() {
    return Number(optional("WORKER_REPLY_POLL_INTERVAL_MS", "300000")); // 5 min
  },
  /** Only poll threads for emails sent within this many days. */
  get replyLookbackDays() {
    return Number(optional("REPLY_LOOKBACK_DAYS", "30"));
  },
  /** Max threads to check per reply-poll pass. */
  get replyBatchSize() {
    return Number(optional("REPLY_BATCH_SIZE", "50"));
  },
} as const;

/** True when the minimum DB config is present (used to guard optional DB calls in dev). */
export function isDbConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI);
}
