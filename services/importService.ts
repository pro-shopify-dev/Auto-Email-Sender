import { DomainError } from "@/lib/errors";
import { ensureIndexes } from "@/lib/db/indexes";
import { parseContactsCsv, type ParseResult } from "@/lib/csv";
import { contactInputSchema, type ContactInput } from "@/models/contact";
import * as contactRepo from "@/repositories/contactRepo";
import { writeAudit } from "@/services/auditService";

const MAX_ROWS = 10_000;

/** Preview: parse CSV and return validation results (no writes). */
export function previewCsv(text: string): ParseResult {
  const result = parseContactsCsv(text);
  if (result.rows.length > MAX_ROWS) {
    throw new DomainError(`CSV exceeds the ${MAX_ROWS}-row limit.`, 413);
  }
  return result;
}

/** Commit: validate incoming contacts and bulk-upsert them. */
export async function commitImport(
  userId: string,
  contacts: unknown[],
): Promise<{ inserted: number; updated: number; skipped: number }> {
  await ensureIndexes();
  if (!Array.isArray(contacts) || contacts.length === 0) {
    throw new DomainError("No contacts to import.", 400);
  }
  if (contacts.length > MAX_ROWS) {
    throw new DomainError(`Cannot import more than ${MAX_ROWS} contacts at once.`, 413);
  }

  const valid: ContactInput[] = [];
  let skipped = 0;
  for (const c of contacts) {
    const parsed = contactInputSchema.safeParse(c);
    if (parsed.success) valid.push(parsed.data);
    else skipped += 1;
  }

  const { inserted, updated } = await contactRepo.bulkUpsert(userId, valid);
  await writeAudit(userId, "contacts.import", { inserted, updated, skipped });
  return { inserted, updated, skipped };
}
