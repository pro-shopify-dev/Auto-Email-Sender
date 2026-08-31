import { ObjectId } from "mongodb";
import { gmailConnectionsCol } from "@/lib/db/collections";
import { env } from "@/lib/env";
import type {
  GmailConnectionDoc,
  GmailConnectionStatus,
} from "@/models/gmailConnection";

/** Fill in fields that may be missing on legacy single-Gmail documents. */
function normalize(doc: GmailConnectionDoc): GmailConnectionDoc {
  return {
    ...doc,
    enabled: doc.enabled ?? true,
    sendLimit: doc.sendLimit ?? env.gmailDefaultSendLimit,
    sentCount: doc.sentCount ?? 0,
    throttlePerWindow: doc.throttlePerWindow ?? env.gmailDefaultThrottlePerWindow,
    throttleWindowSeconds:
      doc.throttleWindowSeconds ?? env.gmailDefaultThrottleWindowSeconds,
  };
}

function hasCapacity(doc: GmailConnectionDoc): boolean {
  return doc.sendLimit === 0 || doc.sentCount < doc.sendLimit;
}

export async function listByUser(userId: string): Promise<GmailConnectionDoc[]> {
  if (!ObjectId.isValid(userId)) return [];
  const col = await gmailConnectionsCol();
  const docs = await col
    .find({ userId: new ObjectId(userId) })
    .sort({ createdAt: 1 })
    .toArray();
  return docs.map(normalize);
}

export async function findById(
  userId: string,
  id: string,
): Promise<GmailConnectionDoc | null> {
  if (!ObjectId.isValid(userId) || !ObjectId.isValid(id)) return null;
  const col = await gmailConnectionsCol();
  const doc = await col.findOne({
    _id: new ObjectId(id),
    userId: new ObjectId(userId),
  });
  return doc ? normalize(doc) : null;
}

/** Accounts that may currently send: enabled, connected, and under their cap. */
export async function listEligibleSenders(
  userId: string,
): Promise<GmailConnectionDoc[]> {
  const all = await listByUser(userId);
  return all.filter(
    (c) => c.enabled && c.status === "connected" && hasCapacity(c),
  );
}

export async function countConnected(userId: string): Promise<number> {
  const all = await listByUser(userId);
  return all.filter((c) => c.status === "connected").length;
}

/** Every connected account across ALL users — used by the worker's draft-pool reconcile. */
export function canManageDrafts(doc: GmailConnectionDoc): boolean {
  return doc.status === "connected" || doc.status === "limit_reached";
}

export async function listAllDraftCapable(): Promise<GmailConnectionDoc[]> {
  const col = await gmailConnectionsCol();
  const docs = await col
    .find({ status: { $in: ["connected", "limit_reached"] } })
    .toArray();
  return docs.map(normalize);
}

export async function hasEligibleSender(userId: string): Promise<boolean> {
  return (await listEligibleSenders(userId)).length > 0;
}

/**
 * Add or refresh a connection, keyed by (userId, gmailAddress). Re-connecting the same
 * address updates its tokens without resetting its counters or settings.
 */
export async function upsertConnection(
  userId: string,
  data: {
    gmailAddress: string;
    encryptedRefreshToken: string;
    encryptedAccessToken: string;
    tokenExpiresAt: Date | null;
  },
): Promise<void> {
  const col = await gmailConnectionsCol();
  const now = new Date();
  await col.updateOne(
    { userId: new ObjectId(userId), gmailAddress: data.gmailAddress },
    {
      $set: {
        encryptedRefreshToken: data.encryptedRefreshToken,
        encryptedAccessToken: data.encryptedAccessToken,
        tokenExpiresAt: data.tokenExpiresAt,
        status: "connected" as GmailConnectionStatus,
        updatedAt: now,
      },
      $setOnInsert: {
        _id: new ObjectId(),
        userId: new ObjectId(userId),
        gmailAddress: data.gmailAddress,
        enabled: true,
        sendLimit: env.gmailDefaultSendLimit,
        sentCount: 0,
        throttlePerWindow: env.gmailDefaultThrottlePerWindow,
        throttleWindowSeconds: env.gmailDefaultThrottleWindowSeconds,
        createdAt: now,
      },
    },
    { upsert: true },
  );
}

/**
 * Atomically record a send: increments sentCount and, if the cap is now reached, flips the
 * account to `limit_reached` so it stops being used. Returns the updated doc.
 */
export async function recordSend(
  connId: ObjectId,
): Promise<GmailConnectionDoc | null> {
  const col = await gmailConnectionsCol();
  const updated = await col.findOneAndUpdate(
    { _id: connId },
    { $inc: { sentCount: 1 }, $set: { updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!updated) return null;
  const doc = normalize(updated);
  if (doc.sendLimit > 0 && doc.sentCount >= doc.sendLimit && doc.status === "connected") {
    await col.updateOne(
      { _id: connId },
      { $set: { status: "limit_reached", updatedAt: new Date() } },
    );
    doc.status = "limit_reached";
  }
  return doc;
}

/** Reset a connection's counter and re-activate it if it had stopped at its cap. */
export async function resetCounter(userId: string, connId: string): Promise<boolean> {
  if (!ObjectId.isValid(connId)) return false;
  const col = await gmailConnectionsCol();
  const res = await col.updateOne(
    { _id: new ObjectId(connId), userId: new ObjectId(userId) },
    [
      {
        $set: {
          sentCount: 0,
          updatedAt: new Date(),
          status: {
            $cond: [{ $eq: ["$status", "limit_reached"] }, "connected", "$status"],
          },
        },
      },
    ],
  );
  return res.matchedCount > 0;
}

export async function updateSettings(
  userId: string,
  connId: string,
  settings: Partial<
    Pick<
      GmailConnectionDoc,
      "enabled" | "sendLimit" | "throttlePerWindow" | "throttleWindowSeconds"
    >
  >,
): Promise<boolean> {
  if (!ObjectId.isValid(connId)) return false;
  const col = await gmailConnectionsCol();
  const set: Record<string, unknown> = { ...settings, updatedAt: new Date() };
  const res = await col.updateOne(
    { _id: new ObjectId(connId), userId: new ObjectId(userId) },
    { $set: set },
  );
  // If the cap was raised above the current count, revive a limit_reached account.
  const doc = await findById(userId, connId);
  if (doc && doc.status === "limit_reached" && hasCapacity(doc)) {
    await col.updateOne(
      { _id: doc._id },
      { $set: { status: "connected", updatedAt: new Date() } },
    );
  }
  return res.matchedCount > 0;
}

export async function setStatus(
  connId: ObjectId,
  status: GmailConnectionStatus,
): Promise<void> {
  const col = await gmailConnectionsCol();
  await col.updateOne(
    { _id: connId },
    { $set: { status, updatedAt: new Date() } },
  );
}

/** Reset the sent counter on ALL of a user's Gmails and re-activate any that were capped. */
export async function resetAllCounters(userId: string): Promise<void> {
  const col = await gmailConnectionsCol();
  await col.updateMany({ userId: new ObjectId(userId) }, [
    {
      $set: {
        sentCount: 0,
        updatedAt: new Date(),
        status: {
          $cond: [{ $eq: ["$status", "limit_reached"] }, "connected", "$status"],
        },
      },
    },
  ]);
}

export async function deleteConnection(
  userId: string,
  connId: string,
): Promise<boolean> {
  if (!ObjectId.isValid(connId)) return false;
  const col = await gmailConnectionsCol();
  const res = await col.deleteOne({
    _id: new ObjectId(connId),
    userId: new ObjectId(userId),
  });
  return res.deletedCount > 0;
}
