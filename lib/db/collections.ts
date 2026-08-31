import type { Collection, ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongo";
import type { UserDoc } from "@/models/user";
import type { GmailConnectionDoc } from "@/models/gmailConnection";
import type { ContactDoc } from "@/models/contact";
import type { TemplateDoc } from "@/models/template";
import type { CampaignDoc } from "@/models/campaign";
import type { EmailJobDoc } from "@/models/emailJob";
import type { AuditLogDoc } from "@/models/auditLog";
import type { GmailDraftDoc } from "@/models/gmailDraft";

export async function usersCol(): Promise<Collection<UserDoc>> {
  return (await getDb()).collection<UserDoc>("users");
}

export async function gmailConnectionsCol(): Promise<Collection<GmailConnectionDoc>> {
  return (await getDb()).collection<GmailConnectionDoc>("gmailConnections");
}

export async function contactsCol(): Promise<Collection<ContactDoc>> {
  return (await getDb()).collection<ContactDoc>("contacts");
}

export async function templatesCol(): Promise<Collection<TemplateDoc>> {
  return (await getDb()).collection<TemplateDoc>("templates");
}

export async function campaignsCol(): Promise<Collection<CampaignDoc>> {
  return (await getDb()).collection<CampaignDoc>("campaigns");
}

export async function emailJobsCol(): Promise<Collection<EmailJobDoc>> {
  return (await getDb()).collection<EmailJobDoc>("emailJobs");
}

export async function auditLogsCol(): Promise<Collection<AuditLogDoc>> {
  return (await getDb()).collection<AuditLogDoc>("auditLogs");
}

export async function gmailDraftsCol(): Promise<Collection<GmailDraftDoc>> {
  return (await getDb()).collection<GmailDraftDoc>("gmailDrafts");
}

/** Per-user sending switch: whether the worker should currently send for this user. */
export interface SendStateDoc {
  _id: ObjectId; // = userId
  paused: boolean;
  updatedAt: Date;
}

export async function sendStateCol(): Promise<Collection<SendStateDoc>> {
  return (await getDb()).collection<SendStateDoc>("sendState");
}
