import { contactStage, type ContactDoc, type PublicContact } from "@/models/contact";
import type { TemplateDoc, PublicTemplate } from "@/models/template";
import type { CampaignDoc, PublicCampaign } from "@/models/campaign";
import type {
  EmailJobDoc,
  PublicEmailJob,
  PublicEmailJobDetail,
} from "@/models/emailJob";

export function toPublicContact(doc: ContactDoc): PublicContact {
  return {
    id: doc._id.toString(),
    firstName: doc.firstName,
    lastName: doc.lastName,
    email: doc.email,
    phone: doc.phone,
    company: doc.company,
    jobTitle: doc.jobTitle,
    address: doc.address,
    city: doc.city,
    state: doc.state,
    zipCode: doc.zipCode,
    country: doc.country,
    notes: doc.notes,
    tags: doc.tags,
    emailStatus: doc.emailStatus,
    lastEmailedAt: doc.lastEmailedAt ? doc.lastEmailedAt.toISOString() : null,
    draftReservedAt: doc.draftReservedAt ? doc.draftReservedAt.toISOString() : null,
    repliedAt: doc.repliedAt ? doc.repliedAt.toISOString() : null,
    stage: contactStage(doc),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toPublicTemplate(doc: TemplateDoc): PublicTemplate {
  return {
    id: doc._id.toString(),
    name: doc.name,
    subject: doc.subject,
    htmlBody: doc.htmlBody,
    textBody: doc.textBody,
    variables: doc.variables,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toPublicCampaign(doc: CampaignDoc): PublicCampaign {
  return {
    id: doc._id.toString(),
    name: doc.name,
    templateIds: (doc.templateIds ?? []).map((t) => t.toString()),
    status: doc.status,
    scheduledAt: doc.scheduledAt ? doc.scheduledAt.toISOString() : null,
    totalCount: doc.totalCount,
    sentCount: doc.sentCount,
    failedCount: doc.failedCount,
    createdAt: doc.createdAt.toISOString(),
  };
}

export function toPublicEmailJob(doc: EmailJobDoc): PublicEmailJob {
  return {
    id: doc._id.toString(),
    campaignId: doc.campaignId ? doc.campaignId.toString() : null,
    to: doc.to,
    fromAddress: doc.fromAddress ?? null,
    templateName: doc.templateName ?? null,
    subject: doc.subject,
    status: doc.status,
    scheduledAt: doc.scheduledAt.toISOString(),
    gmailMessageId: doc.gmailMessageId,
    attempts: doc.attempts,
    lastError: doc.lastError,
    repliedAt: doc.repliedAt ? doc.repliedAt.toISOString() : null,
    replyCount: doc.replyCount ?? 0,
    createdAt: doc.createdAt.toISOString(),
  };
}

export function toPublicEmailJobDetail(doc: EmailJobDoc): PublicEmailJobDetail {
  return {
    ...toPublicEmailJob(doc),
    cc: doc.cc ?? [],
    bcc: doc.bcc ?? [],
    htmlBody: doc.htmlBody,
  };
}
