import { ObjectId, type Filter } from "mongodb";
import { emailJobsCol } from "@/lib/db/collections";
import type { EmailJobDoc, EmailJobStatus } from "@/models/emailJob";

export type NewJob = Omit<
  EmailJobDoc,
  | "_id"
  | "createdAt"
  | "updatedAt"
  | "status"
  | "attempts"
  | "gmailMessageId"
  | "gmailThreadId"
  | "sentByConnectionId"
  | "fromAddress"
  | "repliedAt"
  | "replyCount"
  | "lastError"
> & { status?: EmailJobStatus };

export async function insertOne(job: NewJob): Promise<EmailJobDoc> {
  const col = await emailJobsCol();
  const now = new Date();
  const doc: EmailJobDoc = {
    _id: new ObjectId(),
    status: job.status ?? "queued",
    attempts: 0,
    gmailMessageId: null,
    gmailThreadId: null,
    sentByConnectionId: null,
    fromAddress: null,
    repliedAt: null,
    replyCount: 0,
    lastError: null,
    createdAt: now,
    updatedAt: now,
    ...job,
  };
  await col.insertOne(doc);
  return doc;
}

/**
 * Insert many jobs, ignoring duplicate idempotencyKey collisions (unordered write).
 * Returns the number actually inserted.
 */
export async function insertManyIgnoreDupes(jobs: NewJob[]): Promise<number> {
  if (jobs.length === 0) return 0;
  const col = await emailJobsCol();
  const now = new Date();
  const docs: EmailJobDoc[] = jobs.map((job) => ({
    _id: new ObjectId(),
    status: job.status ?? "queued",
    attempts: 0,
    gmailMessageId: null,
    gmailThreadId: null,
    sentByConnectionId: null,
    fromAddress: null,
    repliedAt: null,
    replyCount: 0,
    lastError: null,
    createdAt: now,
    updatedAt: now,
    ...job,
  }));
  try {
    const res = await col.insertMany(docs, { ordered: false });
    return res.insertedCount;
  } catch (err) {
    // Duplicate-key errors are expected when re-enqueuing; count the successes.
    if (
      typeof err === "object" &&
      err !== null &&
      "insertedCount" in err &&
      typeof (err as { insertedCount?: number }).insertedCount === "number"
    ) {
      return (err as { insertedCount: number }).insertedCount;
    }
    throw err;
  }
}

/**
 * Atomically claim the next due, queued job (FIFO by scheduledAt). Flips it to
 * `processing` so no other worker can pick it up. Returns null when nothing is due.
 */
export async function claimNextDue(now: Date): Promise<EmailJobDoc | null> {
  const col = await emailJobsCol();
  // Claiming does NOT count as a send attempt — a job may be claimed and released many
  // times while waiting for a sender to become available (all Gmails paced/capped).
  const result = await col.findOneAndUpdate(
    { status: "queued", scheduledAt: { $lte: now } },
    { $set: { status: "processing", updatedAt: new Date() } },
    { sort: { scheduledAt: 1 }, returnDocument: "after" },
  );
  return result ?? null;
}

/**
 * Put a claimed job back on the queue without consuming a retry attempt. Used when no
 * sender is available yet (rate-limited or all accounts capped) — the email waits.
 */
export async function releaseToQueue(id: ObjectId, delayMs: number): Promise<void> {
  const col = await emailJobsCol();
  await col.updateOne(
    { _id: id },
    {
      $set: {
        status: "queued",
        scheduledAt: new Date(Date.now() + Math.max(0, delayMs)),
        updatedAt: new Date(),
      },
    },
  );
}

/**
 * Stamp send details onto a job located by its idempotency key — used for drafts the user
 * sent by hand, where the record is created after the fact. Only fills a job that isn't
 * already marked sent, so re-running a reconcile pass can't clobber real send data.
 */
export async function markSentByIdempotencyKey(
  idempotencyKey: string,
  gmailMessageId: string,
  gmailThreadId: string | null,
  sentByConnectionId: ObjectId,
  fromAddress: string,
): Promise<boolean> {
  const col = await emailJobsCol();
  const res = await col.updateOne(
    { idempotencyKey, gmailMessageId: null },
    {
      $set: {
        status: "sent",
        gmailMessageId,
        gmailThreadId,
        sentByConnectionId,
        fromAddress,
        lastError: null,
        updatedAt: new Date(),
      },
    },
  );
  return res.modifiedCount > 0;
}

export async function markSent(
  id: ObjectId,
  gmailMessageId: string,
  gmailThreadId: string | null,
  sentByConnectionId: ObjectId,
  fromAddress: string,
): Promise<void> {
  const col = await emailJobsCol();
  await col.updateOne(
    { _id: id },
    {
      $set: {
        status: "sent",
        gmailMessageId,
        gmailThreadId,
        sentByConnectionId,
        fromAddress,
        lastError: null,
        updatedAt: new Date(),
      },
    },
  );
}

export async function findByIdForUser(
  userId: string,
  id: string,
): Promise<EmailJobDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await emailJobsCol();
  return col.findOne({ _id: new ObjectId(id), userId: new ObjectId(userId) });
}

/** Sent jobs whose threads should be polled for a reply (not yet replied, recent). */
export async function listAwaitingReplyCheck(
  sinceDays: number,
  limit: number,
): Promise<EmailJobDoc[]> {
  const col = await emailJobsCol();
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  return col
    .find({
      status: "sent",
      repliedAt: null,
      gmailThreadId: { $ne: null },
      sentByConnectionId: { $ne: null },
      updatedAt: { $gte: since },
    })
    .sort({ updatedAt: 1 })
    .limit(limit)
    .toArray();
}

export async function markReplied(
  id: ObjectId,
  repliedAt: Date,
  replyCount: number,
): Promise<void> {
  const col = await emailJobsCol();
  await col.updateOne(
    { _id: id },
    { $set: { repliedAt, replyCount, updatedAt: new Date() } },
  );
}

export async function countReplied(userId: string): Promise<number> {
  const col = await emailJobsCol();
  return col.countDocuments({
    userId: new ObjectId(userId),
    repliedAt: { $ne: null },
  });
}

/** Mark a job failed, or requeue it for another attempt if under the cap. Counts an attempt. */
export async function markFailedOrRequeue(
  job: EmailJobDoc,
  error: string,
  backoffMs: number,
): Promise<"failed" | "requeued"> {
  const col = await emailJobsCol();
  const newAttempts = job.attempts + 1;
  if (newAttempts >= job.maxAttempts) {
    await col.updateOne(
      { _id: job._id },
      {
        $set: {
          status: "failed",
          lastError: error,
          attempts: newAttempts,
          updatedAt: new Date(),
        },
      },
    );
    return "failed";
  }
  await col.updateOne(
    { _id: job._id },
    {
      $set: {
        status: "queued",
        lastError: error,
        attempts: newAttempts,
        scheduledAt: new Date(Date.now() + backoffMs),
        updatedAt: new Date(),
      },
    },
  );
  return "requeued";
}

export interface ListParams {
  status?: EmailJobStatus;
  campaignId?: string;
  search?: string;
  repliedOnly?: boolean;
  page: number;
  pageSize: number;
}

export async function list(
  userId: string,
  params: ListParams,
): Promise<{ items: EmailJobDoc[]; total: number }> {
  const col = await emailJobsCol();
  const filter: Filter<EmailJobDoc> = { userId: new ObjectId(userId) };
  if (params.status) filter.status = params.status;
  if (params.campaignId && ObjectId.isValid(params.campaignId)) {
    filter.campaignId = new ObjectId(params.campaignId);
  }
  if (params.repliedOnly) filter.repliedAt = { $ne: null };
  if (params.search) {
    const rx = new RegExp(params.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ to: rx }, { subject: rx }];
  }
  const [items, total] = await Promise.all([
    col
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((params.page - 1) * params.pageSize)
      .limit(params.pageSize)
      .toArray(),
    col.countDocuments(filter),
  ]);
  return { items, total };
}

/** Cancel a queued job (won't be sent). Only affects queued jobs. */
export async function cancelJob(userId: string, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const col = await emailJobsCol();
  const res = await col.updateOne(
    { _id: new ObjectId(id), userId: new ObjectId(userId), status: "queued" },
    { $set: { status: "cancelled", updatedAt: new Date() } },
  );
  return res.modifiedCount > 0;
}

/** Delete ALL email history for a user (used by Reset / Start fresh). */
export async function deleteAllForUser(userId: string): Promise<number> {
  const col = await emailJobsCol();
  const res = await col.deleteMany({ userId: new ObjectId(userId) });
  return res.deletedCount;
}

/** Delete a job/log entry. */
export async function removeJob(userId: string, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const col = await emailJobsCol();
  const res = await col.deleteOne({
    _id: new ObjectId(id),
    userId: new ObjectId(userId),
  });
  return res.deletedCount > 0;
}

/**
 * Free up the `contact:<id>` idempotency key held by cancelled/failed emails so a later
 * Start can queue that contact again. The record is kept for history — only its key is
 * retired (to a unique value). Jobs that actually SENT keep their key, so a contact who
 * received an email can never be queued a second time.
 */
export async function retireStaleContactJobs(userId: string): Promise<number> {
  const col = await emailJobsCol();
  const stale = await col
    .find({
      userId: new ObjectId(userId),
      idempotencyKey: { $regex: "^contact:[^:]+$" },
      status: { $in: ["cancelled", "failed"] },
    })
    .project<{ _id: ObjectId }>({ _id: 1 })
    .toArray();
  if (stale.length === 0) return 0;

  await col.bulkWrite(
    stale.map((j) => ({
      updateOne: {
        filter: { _id: j._id },
        update: { $set: { idempotencyKey: `retired:${j._id.toString()}` } },
      },
    })),
    { ordered: false },
  );
  return stale.length;
}

/** Cancel all still-pending jobs of a campaign (used when deleting a campaign). */
export async function cancelPendingByCampaign(campaignId: ObjectId): Promise<number> {
  const col = await emailJobsCol();
  const res = await col.updateMany(
    { campaignId, status: { $in: ["queued", "processing"] } },
    { $set: { status: "cancelled", updatedAt: new Date() } },
  );
  return res.modifiedCount;
}

export async function countByStatusForCampaign(
  campaignId: ObjectId,
): Promise<Record<string, number>> {
  const col = await emailJobsCol();
  const rows = await col
    .aggregate<{ _id: string; count: number }>([
      { $match: { campaignId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ])
    .toArray();
  return Object.fromEntries(rows.map((r) => [r._id, r.count]));
}

export async function countSentToday(userId: string): Promise<number> {
  const col = await emailJobsCol();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return col.countDocuments({
    userId: new ObjectId(userId),
    status: "sent",
    updatedAt: { $gte: start },
  });
}

export async function countByStatus(
  userId: string,
  status: EmailJobStatus,
): Promise<number> {
  const col = await emailJobsCol();
  return col.countDocuments({ userId: new ObjectId(userId), status });
}

/** Counts per status across all of a user's jobs. */
export async function statusBreakdown(
  userId: string,
): Promise<Record<string, number>> {
  const col = await emailJobsCol();
  const rows = await col
    .aggregate<{ _id: string; count: number }>([
      { $match: { userId: new ObjectId(userId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ])
    .toArray();
  return Object.fromEntries(rows.map((r) => [r._id, r.count]));
}

export interface DailyActivity {
  date: string; // YYYY-MM-DD
  sent: number;
  failed: number;
}

/** Sent/failed counts per day for the last `days` days (dense — zero-filled). */
export async function dailyActivity(
  userId: string,
  days: number,
): Promise<DailyActivity[]> {
  const col = await emailJobsCol();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const rows = await col
    .aggregate<{ _id: { day: string; status: string }; count: number }>([
      {
        $match: {
          userId: new ObjectId(userId),
          status: { $in: ["sent", "failed"] },
          updatedAt: { $gte: start },
        },
      },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const map = new Map<string, { sent: number; failed: number }>();
  for (const r of rows) {
    const entry = map.get(r._id.day) ?? { sent: 0, failed: 0 };
    if (r._id.status === "sent") entry.sent = r.count;
    else if (r._id.status === "failed") entry.failed = r.count;
    map.set(r._id.day, entry);
  }

  const series: DailyActivity[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const e = map.get(key) ?? { sent: 0, failed: 0 };
    series.push({ date: key, sent: e.sent, failed: e.failed });
  }
  return series;
}
