import { z } from "zod";
import type { ObjectId } from "mongodb";

export interface TemplateDoc {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

export const templateInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(160),
  subject: z.string().trim().min(1, "Subject is required").max(500),
  htmlBody: z.string().min(1, "Body is required").max(200_000),
  textBody: z.string().max(200_000).optional().default(""),
});

export type TemplateInput = z.infer<typeof templateInputSchema>;

export interface PublicTemplate {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}
