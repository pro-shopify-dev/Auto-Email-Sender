import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { startSending } from "@/services/campaignService";

export const runtime = "nodejs";

/** Start (or resume) sending to every contact that hasn't been emailed yet. */
export const POST = handler(async (req: NextRequest) => {
  const userId = await requireUserId();
  const body = await req.json();
  return ok(await startSending(userId, body));
});
