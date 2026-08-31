import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { createTemplate, listTemplates } from "@/services/templateService";

export const runtime = "nodejs";

export const GET = handler(async () => {
  const userId = await requireUserId();
  return ok(await listTemplates(userId));
});

export const POST = handler(async (req: NextRequest) => {
  const userId = await requireUserId();
  const body = await req.json();
  return ok(await createTemplate(userId, body), 201);
});
