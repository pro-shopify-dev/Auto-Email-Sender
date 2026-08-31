import { ObjectId } from "mongodb";
import { auditLogsCol } from "@/lib/db/collections";

/** Best-effort audit trail; never throws into the caller's happy path. */
export async function writeAudit(
  userId: ObjectId | string,
  action: string,
  meta: Record<string, unknown> = {},
): Promise<void> {
  try {
    const col = await auditLogsCol();
    await col.insertOne({
      _id: new ObjectId(),
      userId: typeof userId === "string" ? new ObjectId(userId) : userId,
      action,
      meta,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error("[audit] failed to write", action, err);
  }
}
