import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { previewCsv, commitImport } from "@/services/importService";

export const runtime = "nodejs";

/**
 * POST /api/import
 *   ?mode=preview  body: { csv: string }               -> parsed rows + validation
 *   ?mode=commit   body: { contacts: ContactInput[] }  -> bulk upsert
 */
export const POST = handler(async (req: NextRequest) => {
  const userId = await requireUserId();
  const mode = req.nextUrl.searchParams.get("mode") ?? "preview";
  const body = await req.json();

  if (mode === "preview") {
    if (typeof body?.csv !== "string") return fail("Missing csv content.", 400);
    return ok(previewCsv(body.csv));
  }

  if (mode === "commit") {
    const result = await commitImport(userId, body?.contacts ?? []);
    return ok(result);
  }

  return fail("Unknown import mode.", 400);
});
