import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { resetCounter } from "@/services/gmailService";

export const runtime = "nodejs";

/** Reset a connection's sent counter (re-activates it if it had hit its cap). */
export const POST = handler(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    await resetCounter(userId, id);
    return ok({ id });
  },
);
