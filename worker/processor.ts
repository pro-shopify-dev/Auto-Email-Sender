import type { EmailJobDoc } from "@/models/emailJob";
import {
  sendWithConnection,
  recordSend,
  isAuthError,
} from "@/services/gmailService";
import * as emailJobRepo from "@/repositories/emailJobRepo";
import * as contactRepo from "@/repositories/contactRepo";
import * as gmailRepo from "@/repositories/gmailRepo";
import * as sendStateRepo from "@/repositories/sendStateRepo";
import { writeAudit } from "@/services/auditService";
import { SenderPool } from "@/worker/senderPool";

const BASE_BACKOFF_MS = 30_000;
/** How long to hold a job when no account can send yet (rate-limited / all capped). */
const NO_SENDER_RETRY_MS = 60_000;
/** How long to hold a job while the user has sending stopped. */
const PAUSED_RETRY_MS = 15_000;

export interface ProcessResult {
  status: "sent" | "failed" | "requeued" | "waiting";
  /** For "waiting": how long before the worker should look again. */
  retryMs?: number;
  reason?: string;
}

function splitRecipients(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Process a single claimed job:
 *  1. Ask the pool which Gmail should send it (rotation + pacing + cap).
 *  2. If none is available, release the job back to the queue (no attempt consumed).
 *  3. Otherwise send, record the send against that account, and update campaign counters.
 */
export async function processJob(
  job: EmailJobDoc,
  pool: SenderPool,
): Promise<ProcessResult> {
  // Sending stopped by the user — hold the job; Start will resume it right here.
  if (await sendStateRepo.isPaused(job.userId.toString())) {
    await emailJobRepo.releaseToQueue(job._id, PAUSED_RETRY_MS);
    return { status: "waiting", retryMs: PAUSED_RETRY_MS, reason: "paused" };
  }

  const pick = await pool.pick(job.userId.toString());

  if (pick.kind !== "send") {
    const retryMs = pick.kind === "rate-limited" ? pick.retryAfterMs : NO_SENDER_RETRY_MS;
    await emailJobRepo.releaseToQueue(job._id, retryMs);
    return { status: "waiting", retryMs, reason: pick.kind };
  }

  try {
    const { messageId, threadId } = await sendWithConnection(pick.connection, {
      to: splitRecipients(job.to),
      cc: job.cc,
      bcc: job.bcc,
      subject: job.subject,
      htmlBody: job.htmlBody,
      textBody: job.textBody,
    });

    await emailJobRepo.markSent(
      job._id,
      messageId,
      threadId,
      pick.connection._id,
      pick.connection.gmailAddress,
    );
    await recordSend(pick.connection._id); // bump per-account counter, maybe hit cap
    pool.recordUse(pick.connection); // advance pacing window

    // Mark the contact emailed ONLY now that it actually went out, so "remaining" always
    // reflects reality and a Stop/Start resumes exactly where it left off.
    if (job.recipientId) {
      await contactRepo.markEmailed(job.userId.toString(), [job.recipientId]);
    }

    return { status: "sent" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // A bad refresh token is the account's problem, not this email's. Flag the account so it
    // stops being used (and shows "Revoked" in Settings), and HOLD the email — don't burn
    // its retries. Once the account is reconnected, the held emails send.
    if (isAuthError(err)) {
      await gmailRepo.setStatus(pick.connection._id, "revoked");
      await emailJobRepo.releaseToQueue(job._id, NO_SENDER_RETRY_MS);
      await writeAudit(job.userId, "gmail.token_invalid", {
        connId: pick.connection._id.toString(),
        gmailAddress: pick.connection.gmailAddress,
      });
      return { status: "waiting", retryMs: NO_SENDER_RETRY_MS, reason: "auth-revoked" };
    }

    const backoff = BASE_BACKOFF_MS * 2 ** job.attempts;
    const outcome = await emailJobRepo.markFailedOrRequeue(job, message, backoff);
    if (outcome === "failed") {
      await writeAudit(job.userId, "email.failed", {
        jobId: job._id.toString(),
        error: message,
      });
    }
    return { status: outcome };
  }
}

