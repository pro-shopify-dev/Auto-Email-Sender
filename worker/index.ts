/**
 * Standalone email worker. Run with `npm run worker`.
 *
 * Loads env from .env, ensures indexes, then loops: claim the next due job, ask the sender
 * pool which connected Gmail should send it (rotation + per-account pacing + per-account
 * cap), send, record the result. Graceful shutdown on SIGINT/SIGTERM.
 */

// Load .env before importing anything that reads process.env.
try {
  process.loadEnvFile(".env");
} catch {
  console.warn("[worker] no .env file found — relying on ambient environment.");
}

import { env } from "@/lib/env";
import { ensureIndexes } from "@/lib/db/indexes";
import * as emailJobRepo from "@/repositories/emailJobRepo";
import { processJob } from "@/worker/processor";
import { SenderPool } from "@/worker/senderPool";
import { checkReplies } from "@/worker/replyChecker";
import { reconcileAll } from "@/services/draftPoolService";

let running = true;
const pool = new SenderPool();

/** Drain up to a batch of due jobs. Returns how long to sleep before the next tick. */
async function tick(): Promise<number> {
  const batchSize = env.workerBatchSize;

  for (let i = 0; i < batchSize && running; i++) {
    const job = await emailJobRepo.claimNextDue(new Date());
    if (!job) return env.workerPollIntervalMs; // queue empty

    const result = await processJob(job, pool);

    if (result.status === "waiting") {
      // No account can send yet — the job was released back to the queue. Back off so we
      // don't spin, then re-check.
      const wait = Math.min(result.retryMs ?? 1000, env.workerPollIntervalMs);
      console.log(
        `[worker] holding job ${job._id.toString()} (${result.reason}); retry in ~${Math.round(
          wait / 1000,
        )}s`,
      );
      return wait;
    }

    console.log(
      `[worker] job ${job._id.toString()} -> ${result.status} (to: ${job.to})`,
    );
  }
  return 0; // more may be waiting — loop again immediately
}

/**
 * Periodically keep each connected Gmail's Drafts folder topped up with template drafts
 * (runs regardless of whether we're actively sending). Replaces any that were sent/deleted.
 */
function startDraftPolling() {
  if (!env.draftPoolEnabled) {
    console.log("[worker] draft pool disabled (GMAIL_DRAFT_POOL_ENABLED=false).");
    return;
  }
  let busy = false;
  const run = async () => {
    if (busy || !running) return;
    busy = true;
    try {
      const s = await reconcileAll();
      if (s.sent > 0) {
        console.log(
          `[worker] draft pool: ${s.sent} draft(s) you sent by hand recorded — ` +
            `contacts marked emailed, now watching for replies.`,
        );
      }
      if (s.created || s.released || s.deleted) {
        console.log(
          `[worker] draft pool: +${s.created} created, ${s.released} released ` +
            `(deleted unsent), ${s.deleted} trimmed across ${s.connections} account(s).`,
        );
      }
      if (s.needsReconnect.length > 0) {
        console.warn(
          `[worker] draft pool: ${s.needsReconnect.join(", ")} must be reconnected in ` +
            `Settings to grant the new "create drafts" permission.`,
        );
      }
    } catch (err) {
      console.error("[worker] draft pool error:", err);
    } finally {
      busy = false;
    }
  };
  void run(); // once at startup
  const timer = setInterval(run, env.workerDraftPollIntervalMs);
  timer.unref?.();
}

/** Periodically poll sent threads for replies (independent of the send loop). */
function startReplyPolling() {
  let busy = false;
  const timer = setInterval(async () => {
    if (busy || !running) return;
    busy = true;
    try {
      const n = await checkReplies();
      if (n > 0) console.log(`[worker] detected ${n} new repl${n === 1 ? "y" : "ies"}`);
    } catch (err) {
      console.error("[worker] reply poll error:", err);
    } finally {
      busy = false;
    }
  }, env.workerReplyPollIntervalMs);
  timer.unref?.(); // don't keep the process alive solely for reply polling
}

async function main() {
  console.log("[worker] starting…");
  await ensureIndexes();
  console.log(
    `[worker] ready. poll=${env.workerPollIntervalMs}ms batch=${env.workerBatchSize}. ` +
      `Reply polling every ${Math.round(env.workerReplyPollIntervalMs / 1000)}s. ` +
      (env.draftPoolEnabled
        ? `Keeping ${env.draftPoolSize} template drafts per account, checked every ` +
          `${Math.round(env.workerDraftPollIntervalMs / 1000)}s. `
        : "") +
      `Per-Gmail limits & pacing are configured in Settings.`,
  );
  startReplyPolling();
  startDraftPolling();

  while (running) {
    try {
      const waitMs = await tick();
      if (waitMs > 0) await sleep(waitMs);
    } catch (err) {
      console.error("[worker] loop error:", err);
      await sleep(env.workerPollIntervalMs);
    }
  }
  console.log("[worker] stopped.");
  process.exit(0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function shutdown(signal: string) {
  console.log(`[worker] received ${signal}, finishing current work…`);
  running = false;
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
