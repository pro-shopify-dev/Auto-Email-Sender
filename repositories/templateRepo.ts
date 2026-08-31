import { ObjectId } from "mongodb";
import { templatesCol } from "@/lib/db/collections";
import type { TemplateDoc } from "@/models/template";

export async function list(userId: string): Promise<TemplateDoc[]> {
  const col = await templatesCol();
  return col
    .find({ userId: new ObjectId(userId) })
    .sort({ updatedAt: -1 })
    .toArray();
}

export async function findById(
  userId: string,
  id: string,
): Promise<TemplateDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await templatesCol();
  return col.findOne({ _id: new ObjectId(id), userId: new ObjectId(userId) });
}

export async function create(
  userId: string,
  data: Omit<TemplateDoc, "_id" | "userId" | "createdAt" | "updatedAt">,
): Promise<TemplateDoc> {
  const col = await templatesCol();
  const now = new Date();
  const doc: TemplateDoc = {
    _id: new ObjectId(),
    userId: new ObjectId(userId),
    createdAt: now,
    updatedAt: now,
    ...data,
  };
  await col.insertOne(doc);
  return doc;
}

export async function update(
  userId: string,
  id: string,
  data: Partial<Omit<TemplateDoc, "_id" | "userId" | "createdAt">>,
): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const col = await templatesCol();
  const res = await col.updateOne(
    { _id: new ObjectId(id), userId: new ObjectId(userId) },
    { $set: { ...data, updatedAt: new Date() } },
  );
  return res.matchedCount > 0;
}

export async function remove(userId: string, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const col = await templatesCol();
  const res = await col.deleteOne({
    _id: new ObjectId(id),
    userId: new ObjectId(userId),
  });
  return res.deletedCount > 0;
}

export async function countForUser(userId: string): Promise<number> {
  const col = await templatesCol();
  return col.countDocuments({ userId: new ObjectId(userId) });
}
