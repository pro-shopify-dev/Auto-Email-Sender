import { DomainError } from "@/lib/errors";
import { ensureIndexes } from "@/lib/db/indexes";
import { extractVariables } from "@/lib/template";
import { htmlToText } from "@/lib/mime";
import { toPublicTemplate } from "@/lib/serialize";
import { templateInputSchema, type PublicTemplate } from "@/models/template";
import * as templateRepo from "@/repositories/templateRepo";
import { writeAudit } from "@/services/auditService";

export async function listTemplates(userId: string): Promise<PublicTemplate[]> {
  const docs = await templateRepo.list(userId);
  return docs.map(toPublicTemplate);
}

export async function getTemplate(
  userId: string,
  id: string,
): Promise<PublicTemplate> {
  const doc = await templateRepo.findById(userId, id);
  if (!doc) throw new DomainError("Template not found.", 404);
  return toPublicTemplate(doc);
}

export async function createTemplate(
  userId: string,
  raw: unknown,
): Promise<PublicTemplate> {
  await ensureIndexes();
  const input = templateInputSchema.parse(raw);
  const variables = extractVariables(input.subject, input.htmlBody);
  const textBody = input.textBody?.trim() ? input.textBody : htmlToText(input.htmlBody);
  const doc = await templateRepo.create(userId, {
    name: input.name,
    subject: input.subject,
    htmlBody: input.htmlBody,
    textBody,
    variables,
  });
  await writeAudit(userId, "template.create", { templateId: doc._id.toString() });
  return toPublicTemplate(doc);
}

export async function updateTemplate(
  userId: string,
  id: string,
  raw: unknown,
): Promise<void> {
  const input = templateInputSchema.parse(raw);
  const variables = extractVariables(input.subject, input.htmlBody);
  const textBody = input.textBody?.trim() ? input.textBody : htmlToText(input.htmlBody);
  const ok = await templateRepo.update(userId, id, {
    name: input.name,
    subject: input.subject,
    htmlBody: input.htmlBody,
    textBody,
    variables,
  });
  if (!ok) throw new DomainError("Template not found.", 404);
}

export async function deleteTemplate(userId: string, id: string): Promise<void> {
  const ok = await templateRepo.remove(userId, id);
  if (!ok) throw new DomainError("Template not found.", 404);
}
