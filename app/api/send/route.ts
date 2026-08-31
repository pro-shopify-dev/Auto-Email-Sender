import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { enqueueSingle } from "@/services/emailService";

export const runtime = "nodejs";

/** Enqueue a single or test email. The worker sends it asynchronously. */
export const POST = handler(async (req: NextRequest) => {
  const userId = await requireUserId();
  const body = await req.json();
  const job = await enqueueSingle(userId, body);
  return ok(job, 202);
});
