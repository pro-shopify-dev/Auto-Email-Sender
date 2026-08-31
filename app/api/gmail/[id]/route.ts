import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { updateConnectionSettings, disconnect } from "@/services/gmailService";

export const runtime = "nodejs";

/** Update a connection's limit / pacing / enabled toggle. */
export const PATCH = handler(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    const body = await req.json();
    await updateConnectionSettings(userId, id, body);
    return ok({ id });
  },
);

/** Disconnect a Gmail account. */
export const DELETE = handler(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    await disconnect(userId, id);
    return ok({ id });
  },
);
