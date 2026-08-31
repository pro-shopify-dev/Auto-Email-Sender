import { ObjectId, type Filter } from "mongodb";
import { contactsCol } from "@/lib/db/collections";
import { CONTACT_STAGES } from "@/models/contact";
import type { ContactDoc, ContactInput, ContactStage } from "@/models/contact";

export interface ListParams {
  search?: string;
  tag?: string;
  stage?: ContactStage;
  page: number;
  pageSize: number;
}

/** "Field is unset or null" — contacts predating a field simply don't have it. */
const unset = (field: string): Filter<ContactDoc> => ({
  $or: [{ [field]: null }, { [field]: { $exists: false } }],
});

/**
 * Mongo filter for a lifecycle stage. Mirrors `contactStage()` exactly — if you change one,
 * change the other, or the list and its badges will disagree.
 */
function stageFilter(stage: ContactStage): Filter<ContactDoc> {
  switch (stage) {
    case "bounced":
      return { emailStatus: "bounced" };
    case "unsubscribed":
      return { emailStatus: "unsubscribed" };
    case "replied":
      return { emailStatus: "active", repliedAt: { $ne: null } };
    case "sent":
      return {
        emailStatus: "active",
        lastEmailedAt: { $ne: null },
        $and: [unset("repliedAt")],
      };
    case "in_draft":
      return {
        emailStatus: "active",
        draftReservedAt: { $ne: null },
        $and: [unset("lastEmailedAt"), unset("repliedAt")],
      };
    case "fresh":
    default:
      return {
        emailStatus: "active",
        $and: [
          unset("lastEmailedAt"),
          unset("draftReservedAt"),
          unset("repliedAt"),
        ],
      };
  }
}

export interface ListResult {
  items: ContactDoc[];
  total: number;
}

export async function list(
  userId: string,
  params: ListParams,
): Promise<ListResult> {
  const col = await contactsCol();
  const filter: Filter<ContactDoc> = { userId: new ObjectId(userId) };

  if (params.search) {
    const rx = new RegExp(escapeRegex(params.search), "i");
    filter.$or = [
      { firstName: rx },
      { lastName: rx },
      { email: rx },
      { company: rx },
    ];
  }
  if (params.tag) {
    filter.tags = params.tag;
  }
  if (params.stage) {
    // Merge the stage clauses in, keeping search's own $or intact.
    const { $and: stageAnd, ...rest } = stageFilter(params.stage);
    Object.assign(filter, rest);
    if (stageAnd) filter.$and = [...(filter.$and ?? []), ...stageAnd];
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

export async function findById(
  userId: string,
  id: string,
): Promise<ContactDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await contactsCol();
  return col.findOne({ _id: new ObjectId(id), userId: new ObjectId(userId) });
}

export async function findByIds(
  userId: string,
  ids: string[],
): Promise<ContactDoc[]> {
  const objIds = ids.filter((i) => ObjectId.isValid(i)).map((i) => new ObjectId(i));
  if (objIds.length === 0) return [];
  const col = await contactsCol();
  return col
    .find({ userId: new ObjectId(userId), _id: { $in: objIds } })
    .toArray();
}

export async function create(
  userId: string,
  input: ContactInput,
): Promise<ContactDoc> {
  const col = await contactsCol();
  const now = new Date();
  const doc: ContactDoc = {
    _id: new ObjectId(),
    userId: new ObjectId(userId),
    ...input,
    lastEmailedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await col.insertOne(doc);
  return doc;
}

/**
 * Filter matching contacts that may still be sent to: active, never emailed, and not
 * currently held by a waiting Gmail draft.
 */
function sendableFilter(userId: string): Filter<ContactDoc> {
  return {
    userId: new ObjectId(userId),
    emailStatus: "active",
    $or: [{ lastEmailedAt: null }, { lastEmailedAt: { $exists: false } }],
    $and: [
      {
        $or: [
          { draftReservedAt: null },
          { draftReservedAt: { $exists: false } },
        ],
      },
    ],
  };
}

/**
 * Atomically take `count` contacts for new drafts, flagging each as reserved so neither the
 * auto-sender nor another draft can claim them. Returns the contacts actually claimed.
 */
export async function claimForDrafts(
  userId: string,
  count: number,
): Promise<ContactDoc[]> {
  if (count <= 0) return [];
  const col = await contactsCol();
  const claimed: ContactDoc[] = [];
  for (let i = 0; i < count; i++) {
    const doc = await col.findOneAndUpdate(
      sendableFilter(userId),
      { $set: { draftReservedAt: new Date(), updatedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!doc) break; // nothing sendable left
    claimed.push(doc);
  }
  return claimed;
}

/** Hand contacts back to the sendable pool (their draft was deleted without being sent). */
export async function releaseDraftReservations(
  userId: string,
  ids: ObjectId[],
): Promise<void> {
  if (ids.length === 0) return;
  const col = await contactsCol();
  await col.updateMany(
    { _id: { $in: ids }, userId: new ObjectId(userId) },
    { $set: { draftReservedAt: null, updatedAt: new Date() } },
  );
}

/**
 * Safety net: free contacts still flagged as reserved that no live draft actually holds
 * (e.g. a draft vanished while the app was down). Only touches reservations older than
 * `minAgeMs` so it can never race with a draft being created right now.
 */
export async function releaseOrphanReservations(
  userId: string,
  heldIds: ObjectId[],
  minAgeMs = 10 * 60 * 1000,
): Promise<number> {
  const col = await contactsCol();
  const res = await col.updateMany(
    {
      userId: new ObjectId(userId),
      draftReservedAt: { $ne: null, $lt: new Date(Date.now() - minAgeMs) },
      _id: { $nin: heldIds },
    },
    { $set: { draftReservedAt: null, updatedAt: new Date() } },
  );
  return res.modifiedCount;
}

/** Record that a contact replied, so their stage shows as "Replied". */
export async function markReplied(
  userId: string,
  id: ObjectId,
  repliedAt: Date,
): Promise<void> {
  const col = await contactsCol();
  await col.updateOne(
    { _id: id, userId: new ObjectId(userId) },
    { $set: { repliedAt, updatedAt: new Date() } },
  );
}

export async function countDraftReserved(userId: string): Promise<number> {
  const col = await contactsCol();
  return col.countDocuments({
    userId: new ObjectId(userId),
    draftReservedAt: { $ne: null },
  });
}

/** Active contacts that have not been emailed yet (the targets of a Start). */
export async function findSendable(
  userId: string,
  limit = 10_000,
): Promise<ContactDoc[]> {
  const col = await contactsCol();
  return col.find(sendableFilter(userId)).limit(limit).toArray();
}

export async function countSendable(userId: string): Promise<number> {
  const col = await contactsCol();
  return col.countDocuments(sendableFilter(userId));
}

export async function countEmailed(userId: string): Promise<number> {
  const col = await contactsCol();
  return col.countDocuments({
    userId: new ObjectId(userId),
    lastEmailedAt: { $ne: null },
  });
}

/**
 * Full reset: clear the emailed mark AND set every contact back to "active" — so a fresh
 * Start emails the entire list. (The unsubscribed flag today only comes from legacy imports;
 * this makes "Start fresh" truly fresh.)
 */
export async function resetAllEmailed(userId: string): Promise<number> {
  const col = await contactsCol();
  const res = await col.updateMany(
    { userId: new ObjectId(userId) },
    {
      $set: {
        lastEmailedAt: null,
        emailStatus: "active",
        draftReservedAt: null,
        repliedAt: null,
        updatedAt: new Date(),
      },
    },
  );
  return res.modifiedCount;
}

/** Mark contacts as emailed so a future Start never sends to them again. */
export async function markEmailed(
  userId: string,
  ids: ObjectId[],
): Promise<void> {
  if (ids.length === 0) return;
  const col = await contactsCol();
  // Clearing the draft hold too: once emailed, the reservation has served its purpose.
  await col.updateMany(
    { _id: { $in: ids }, userId: new ObjectId(userId) },
    { $set: { lastEmailedAt: new Date(), draftReservedAt: null, updatedAt: new Date() } },
  );
}

export async function update(
  userId: string,
  id: string,
  input: ContactInput,
): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const col = await contactsCol();
  const res = await col.updateOne(
    { _id: new ObjectId(id), userId: new ObjectId(userId) },
    { $set: { ...input, updatedAt: new Date() } },
  );
  return res.matchedCount > 0;
}

export async function remove(userId: string, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const col = await contactsCol();
  const res = await col.deleteOne({
    _id: new ObjectId(id),
    userId: new ObjectId(userId),
  });
  return res.deletedCount > 0;
}

/** How many contacts sit in each lifecycle stage. */
export async function stageCounts(
  userId: string,
): Promise<Record<ContactStage, number>> {
  const col = await contactsCol();
  const base = { userId: new ObjectId(userId) };
  const entries = await Promise.all(
    CONTACT_STAGES.map(async (stage) => {
      const { $and: stageAnd, ...rest } = stageFilter(stage);
      const filter: Filter<ContactDoc> = { ...base, ...rest };
      if (stageAnd) filter.$and = stageAnd;
      return [stage, await col.countDocuments(filter)] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<ContactStage, number>;
}

export async function countForUser(userId: string): Promise<number> {
  const col = await contactsCol();
  return col.countDocuments({ userId: new ObjectId(userId) });
}

/**
 * Bulk upsert by (userId, email) — used by CSV import. Returns inserted/updated counts.
 */
export async function bulkUpsert(
  userId: string,
  contacts: ContactInput[],
): Promise<{ inserted: number; updated: number }> {
  if (contacts.length === 0) return { inserted: 0, updated: 0 };
  const col = await contactsCol();
  const now = new Date();
  const ops = contacts.map((c) => ({
    updateOne: {
      filter: { userId: new ObjectId(userId), email: c.email },
      update: {
        $set: { ...c, updatedAt: now },
        $setOnInsert: {
          _id: new ObjectId(),
          userId: new ObjectId(userId),
          lastEmailedAt: null,
          createdAt: now,
        },
      },
      upsert: true,
    },
  }));
  const res = await col.bulkWrite(ops, { ordered: false });
  return { inserted: res.upsertedCount, updated: res.modifiedCount };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
