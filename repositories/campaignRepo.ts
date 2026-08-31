import { ObjectId, type Filter } from "mongodb";
import { campaignsCol } from "@/lib/db/collections";
import type { CampaignDoc, CampaignStatus } from "@/models/campaign";

export interface ListParams {
  search?: string;
  status?: CampaignStatus;
  page: number;
  pageSize: number;
}

export async function list(
  userId: string,
  params: ListParams,
): Promise<{ items: CampaignDoc[]; total: number }> {
  const col = await campaignsCol();
  const filter: Filter<CampaignDoc> = { userId: new ObjectId(userId) };
  if (params.search) {
    filter.name = new RegExp(params.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  }
  if (params.status) filter.status = params.status;

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

export async function remove(userId: string, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const col = await campaignsCol();
  const res = await col.deleteOne({
    _id: new ObjectId(id),
    userId: new ObjectId(userId),
  });
  return res.deletedCount > 0;
}

export async function findById(
  userId: string,
  id: string,
): Promise<CampaignDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await campaignsCol();
  return col.findOne({ _id: new ObjectId(id), userId: new ObjectId(userId) });
}

export async function create(data: {
  userId: string;
  name: string;
  templateIds: string[];
  status: CampaignStatus;
  scheduledAt: Date | null;
  totalCount: number;
}): Promise<CampaignDoc> {
  const col = await campaignsCol();
  const now = new Date();
  const doc: CampaignDoc = {
    _id: new ObjectId(),
    userId: new ObjectId(data.userId),
    name: data.name,
    templateIds: data.templateIds.map((t) => new ObjectId(t)),
    status: data.status,
    scheduledAt: data.scheduledAt,
    totalCount: data.totalCount,
    sentCount: 0,
    failedCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  await col.insertOne(doc);
  return doc;
}

export async function setStatus(
  id: ObjectId,
  status: CampaignStatus,
): Promise<void> {
  const col = await campaignsCol();
  await col.updateOne(
    { _id: id },
    { $set: { status, updatedAt: new Date() } },
  );
}

/** Atomically bump sent/failed counters after each job resolves (used by the worker). */
export async function incrementCounters(
  id: ObjectId,
  field: "sentCount" | "failedCount",
): Promise<CampaignDoc | null> {
  const col = await campaignsCol();
  const res = await col.findOneAndUpdate(
    { _id: id },
    { $inc: { [field]: 1 }, $set: { updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  return res ?? null;
}

export async function countForUser(userId: string): Promise<number> {
  const col = await campaignsCol();
  return col.countDocuments({ userId: new ObjectId(userId) });
}

export async function countActive(userId: string): Promise<number> {
  const col = await campaignsCol();
  return col.countDocuments({
    userId: new ObjectId(userId),
    status: { $in: ["queued", "sending"] },
  });
}
