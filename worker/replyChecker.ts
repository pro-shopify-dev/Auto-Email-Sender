import { env } from "@/lib/env";
import * as emailJobRepo from "@/repositories/emailJobRepo";
import * as gmailRepo from "@/repositories/gmailRepo";
import * as contactRepo from "@/repositories/contactRepo";
import { checkThreadForReply } from "@/services/gmailService";
import type { GmailConnectionDoc } from "@/models/gmailConnection";

/**
 * Poll sent threads for replies. For each recent sent email that hasn't been marked
 * replied, read its thread (via the account that sent it, headers-only) and, if the
 * recipient replied, record it. Per-job errors (revoked token, missing scope, thread
 * gone) are swallowed so one bad account doesn't stall the pass.
 */
export async function checkReplies(): Promise<number> {
  const jobs = await emailJobRepo.listAwaitingReplyCheck(
    env.replyLookbackDays,
    env.replyBatchSize,
  );
  if (jobs.length === 0) return 0;

  const connCache = new Map<string, GmailConnectionDoc | null>();
  let found = 0;

  for (const job of jobs) {
    if (!job.gmailThreadId || !job.sentByConnectionId) continue;
    const connKey = job.sentByConnectionId.toString();

    let conn = connCache.get(connKey);
    if (conn === undefined) {
      conn = await gmailRepo.findById(job.userId.toString(), connKey);
      connCache.set(connKey, conn);
    }
    if (!conn) continue;

    try {
      const result = await checkThreadForReply(conn, job.gmailThreadId);
      if (result.replied) {
        const at = result.at ?? new Date();
        await emailJobRepo.markReplied(job._id, at, result.count);
        // Mirror it onto the contact so their stage reads "Replied" in the list.
        if (job.recipientId) {
          await contactRepo.markReplied(job.userId.toString(), job.recipientId, at);
        }
        found += 1;
      }
    } catch (err) {
      console.error(
        `[worker] reply check failed for job ${job._id.toString()}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return found;
}
