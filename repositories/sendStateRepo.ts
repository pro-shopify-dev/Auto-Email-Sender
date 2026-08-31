import { ObjectId } from "mongodb";
import { sendStateCol } from "@/lib/db/collections";

/**
 * The per-user sending switch. Default (no document) = running, so a fresh user sends as
 * soon as they hit Start. Stopping sets paused=true and the worker holds every job until
 * Start flips it back — sending then resumes exactly where it left off.
 */

export async function isPaused(userId: string): Promise<boolean> {
  if (!ObjectId.isValid(userId)) return false;
  const col = await sendStateCol();
  const doc = await col.findOne({ _id: new ObjectId(userId) });
  return doc?.paused ?? false;
}

export async function setPaused(userId: string, paused: boolean): Promise<void> {
  const col = await sendStateCol();
  await col.updateOne(
    { _id: new ObjectId(userId) },
    { $set: { paused, updatedAt: new Date() } },
    { upsert: true },
  );
}
