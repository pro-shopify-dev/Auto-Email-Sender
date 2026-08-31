import type { ObjectId } from "mongodb";

export interface AuditLogDoc {
  _id: ObjectId;
  userId: ObjectId;
  action: string;
  meta: Record<string, unknown>;
  createdAt: Date;
}
