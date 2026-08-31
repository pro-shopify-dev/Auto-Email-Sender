import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import {
  cancelHistoryJob,
  deleteHistoryJob,
  getHistoryDetail,
} from "@/services/historyService";

export const runtime = "nodejs";

/** Full detail of one email, including the rendered body. */
export const GET = handler(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    return ok(await getHistoryDetail(userId, id));
  },
);

/** ?action=cancel cancels a queued email; otherwise deletes the log entry. */
export const POST = handler(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    const action = req.nextUrl.searchParams.get("action");
    if (action === "cancel") {
      await cancelHistoryJob(userId, id);
      return ok({ id, cancelled: true });
    }
    return fail("Unknown action.", 400);
  },
);

export const DELETE = handler(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    await deleteHistoryJob(userId, id);
    return ok({ id });
  },
);
