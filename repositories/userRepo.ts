import { ObjectId } from "mongodb";
import { usersCol } from "@/lib/db/collections";
import type { UserDoc } from "@/models/user";

export async function findByEmail(email: string): Promise<UserDoc | null> {
  const col = await usersCol();
  return col.findOne({ email: email.toLowerCase() });
}

export async function findById(id: string): Promise<UserDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await usersCol();
  return col.findOne({ _id: new ObjectId(id) });
}

export async function createUser(input: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<UserDoc> {
  const col = await usersCol();
  const doc: UserDoc = {
    _id: new ObjectId(),
    name: input.name,
    email: input.email.toLowerCase(),
    passwordHash: input.passwordHash,
    role: "user",
    createdAt: new Date(),
  };
  await col.insertOne(doc);
  return doc;
}
