import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { deleteContact, updateContact } from "@/services/contactService";

export const runtime = "nodejs";

export const PATCH = handler(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    const body = await req.json();
    await updateContact(userId, id, body);
    return ok({ id });
  },
);

export const DELETE = handler(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    await deleteContact(userId, id);
    return ok({ id });
  },
);
