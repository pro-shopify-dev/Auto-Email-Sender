import bcrypt from "bcryptjs";
import { registerSchema, type RegisterInput, type UserDoc } from "@/models/user";
import * as userRepo from "@/repositories/userRepo";
import { ensureIndexes } from "@/lib/db/indexes";
import { writeAudit } from "@/services/auditService";

const BCRYPT_ROUNDS = 12;

export class AuthError extends Error {}

/** Register a new user. Throws AuthError on duplicate email or validation failure. */
export async function register(input: RegisterInput): Promise<UserDoc> {
  const parsed = registerSchema.parse(input);
  await ensureIndexes();

  const existing = await userRepo.findByEmail(parsed.email);
  if (existing) {
    throw new AuthError("An account with that email already exists.");
  }

  const passwordHash = await bcrypt.hash(parsed.password, BCRYPT_ROUNDS);
  const user = await userRepo.createUser({
    name: parsed.name,
    email: parsed.email,
    passwordHash,
  });

  await writeAudit(user._id, "user.register", { email: user.email });
  return user;
}

/** Verify credentials; returns the user on success or null on failure. */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<UserDoc | null> {
  const user = await userRepo.findByEmail(email);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
}
