import { ObjectId } from "mongodb";
import { gmailDraftsCol } from "@/lib/db/collections";
import type { GmailDraftDoc } from "@/models/gmailDraft";

export interface NewDraftRecord {
  userId: ObjectId;
  connectionId: ObjectId;
  gmailAddress: string;
  gmailDraftId: string;
  gmailMessageId: string;
  gmailThreadId: string;
  contactId: ObjectId | null;
  toEmail: string;
  templateId: ObjectId | null;
  templateName: string;
  subject: string;
  htmlBody: string;
  textBody: string;
}

/** Draft records we manage for a given connection. */
export async function listByConnection(
  connectionId: ObjectId,
): Promise<GmailDraftDoc[]> {
  const col = await gmailDraftsCol();
  return col.find({ connectionId }).sort({ createdAt: 1 }).toArray();
}

/** Contact ids currently held by a live draft record, across all of a user's accounts. */
export async function listHeldContactIds(userId: string): Promise<ObjectId[]> {
  const col = await gmailDraftsCol();
  const docs = await col
    .find({ userId: new ObjectId(userId), contactId: { $ne: null } })
    .project<{ contactId: ObjectId }>({ contactId: 1 })
    .toArray();
  return docs.map((d) => d.contactId);
}

export async function record(input: NewDraftRecord): Promise<void> {
  const col = await gmailDraftsCol();
  await col.insertOne({
    _id: new ObjectId(),
    ...input,
    createdAt: new Date(),
  });
}

/** Forget draft records whose Gmail draft id no longer exists (sent or deleted). */
export async function removeByDraftIds(
  connectionId: ObjectId,
  gmailDraftIds: string[],
): Promise<number> {
  if (gmailDraftIds.length === 0) return 0;
  const col = await gmailDraftsCol();
  const res = await col.deleteMany({
    connectionId,
    gmailDraftId: { $in: gmailDraftIds },
  });
  return res.deletedCount;
}

/** Drop all draft records for a connection (used when it is disconnected). */
export async function deleteAllForConnection(
  connectionId: ObjectId,
): Promise<number> {
  const col = await gmailDraftsCol();
  const res = await col.deleteMany({ connectionId });
  return res.deletedCount;
}

export async function deleteAllForUser(userId: string): Promise<number> {
  const col = await gmailDraftsCol();
  const res = await col.deleteMany({ userId: new ObjectId(userId) });
  return res.deletedCount;
}
