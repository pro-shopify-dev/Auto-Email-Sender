import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "@/lib/session";
import { AuthError } from "@/services/authService";
import { DomainError } from "@/lib/errors";

export { DomainError };

export function ok<T>(data: T, init?: number): NextResponse {
  return NextResponse.json({ ok: true, data }, { status: init ?? 200 });
}

export function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/**
 * Wrap an async route handler so thrown errors become clean JSON responses.
 * Maps Zod/Unauthorized/domain errors to appropriate status codes.
 */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<NextResponse>,
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return fail("You must be signed in.", 401);
      }
      if (err instanceof ZodError) {
        const first = err.errors[0];
        return fail(first?.message ?? "Invalid input.", 422);
      }
      if (err instanceof AuthError) {
        return fail(err.message, 409);
      }
      if (err instanceof DomainError) {
        return fail(err.message, err.status);
      }
      console.error("[api] unhandled error", err);
      return fail("Something went wrong. Please try again.", 500);
    }
  };
}
