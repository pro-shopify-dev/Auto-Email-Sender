import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import {
  deleteTemplate,
  getTemplate,
  updateTemplate,
} from "@/services/templateService";

export const runtime = "nodejs";

export const GET = handler(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    return ok(await getTemplate(userId, id));
  },
);

export const PATCH = handler(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    const body = await req.json();
    await updateTemplate(userId, id, body);
    return ok({ id });
  },
);

export const DELETE = handler(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    await deleteTemplate(userId, id);
    return ok({ id });
  },
);
