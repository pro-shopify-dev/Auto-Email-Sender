import { auth } from "@/lib/auth";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

/** Returns the authenticated user's id, or throws UnauthorizedError. Use in route handlers. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new UnauthorizedError();
  return id;
}

/** Returns the full session user or null (for pages that render either way). */
export async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}
