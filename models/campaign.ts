import { z } from "zod";
import type { ObjectId } from "mongodb";

export type CampaignStatus =
  | "draft"
  | "queued"
  | "sending"
  | "completed"
  | "failed";

export interface CampaignDoc {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  /** One or more templates; each contact gets ONE, chosen at random from this set. */
  templateIds: ObjectId[];
  status: CampaignStatus;
  scheduledAt: Date | null;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Start a send run: pick one or more templates; everyone eligible is targeted. */
export const startSendingSchema = z.object({
  templateIds: z
    .array(z.string().min(1))
    .min(1, "Select at least one template")
    .max(50),
});

export type StartSendingInput = z.infer<typeof startSendingSchema>;

export interface PublicCampaign {
  id: string;
  name: string;
  templateIds: string[];
  status: CampaignStatus;
  scheduledAt: string | null;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
}
