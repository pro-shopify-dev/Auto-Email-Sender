import { z } from "zod";
import type { ObjectId } from "mongodb";

export type EmailStatus = "active" | "bounced" | "unsubscribed";

export interface ContactDoc {
  _id: ObjectId;
  userId: ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  notes: string;
  tags: string[];
  emailStatus: EmailStatus;
  /** When this contact was (last) sent an email. Once set, they are never sent again. */
  lastEmailedAt: Date | null;
  /**
   * Set while this contact is held by a waiting Gmail draft. Reserved contacts are excluded
   * from automatic sending so they can't be emailed twice; cleared if the draft is deleted.
   */
  draftReservedAt?: Date | null;
  /** Set when this contact replies to something we sent them. */
  repliedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const optionalString = z.string().trim().max(500).optional().default("");

export const contactInputSchema = z.object({
  // Name is optional — email is the only required field. Blank names are allowed
  // (e.g. imported rows where only an email exists).
  firstName: z.string().trim().max(120).optional().default(""),
  lastName: optionalString,
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: optionalString,
  company: optionalString,
  jobTitle: optionalString,
  address: optionalString,
  city: optionalString,
  state: optionalString,
  zipCode: optionalString,
  country: optionalString,
  notes: z.string().trim().max(2000).optional().default(""),
  tags: z.array(z.string().trim().min(1).max(60)).max(50).optional().default([]),
  emailStatus: z.enum(["active", "bounced", "unsubscribed"]).optional().default("active"),
});

export type ContactInput = z.infer<typeof contactInputSchema>;

/**
 * Where a contact sits in the sending lifecycle. Derived from the contact's own fields
 * rather than stored, so it can never drift out of sync with reality.
 */
export type ContactStage =
  | "fresh" // never contacted — free to send to
  | "in_draft" // held by a draft waiting in Gmail
  | "sent" // emailed; never emailed again
  | "replied" // they wrote back
  | "bounced"
  | "unsubscribed";

export const CONTACT_STAGES: ContactStage[] = [
  "fresh",
  "in_draft",
  "sent",
  "replied",
  "bounced",
  "unsubscribed",
];

export const CONTACT_STAGE_LABELS: Record<ContactStage, string> = {
  fresh: "Fresh",
  in_draft: "In draft",
  sent: "Sent",
  replied: "Replied",
  bounced: "Bounced",
  unsubscribed: "Unsubscribed",
};

/** Fields the stage is computed from — accepts both DB docs and serialized contacts. */
export interface StageSource {
  emailStatus?: EmailStatus;
  lastEmailedAt?: Date | string | null;
  draftReservedAt?: Date | string | null;
  repliedAt?: Date | string | null;
}

/**
 * Work out a contact's stage. Order matters: a reply outranks the send that prompted it,
 * and a bounce/unsubscribe outranks everything.
 */
export function contactStage(c: StageSource): ContactStage {
  if (c.emailStatus === "bounced") return "bounced";
  if (c.emailStatus === "unsubscribed") return "unsubscribed";
  if (c.repliedAt) return "replied";
  if (c.lastEmailedAt) return "sent";
  if (c.draftReservedAt) return "in_draft";
  return "fresh";
}

export interface PublicContact extends ContactInput {
  id: string;
  lastEmailedAt: string | null;
  draftReservedAt: string | null;
  repliedAt: string | null;
  stage: ContactStage;
  createdAt: string;
  updatedAt: string;
}
