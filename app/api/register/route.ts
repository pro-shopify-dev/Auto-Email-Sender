import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { registerSchema } from "@/models/user";
import { register } from "@/services/authService";

export const runtime = "nodejs";

export const POST = handler(async (req: NextRequest) => {
  const body = await req.json();
  const input = registerSchema.parse(body);
  const user = await register(input);
  return ok({ id: user._id.toString(), email: user.email }, 201);
});
