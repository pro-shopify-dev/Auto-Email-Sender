import { z } from "zod";
import type { ObjectId } from "mongodb";

export type GmailConnectionStatus =
  | "connected"
  | "revoked"
  | "error"
  | "limit_reached";

export interface GmailConnectionDoc {
  _id: ObjectId;
  userId: ObjectId;
  gmailAddress: string;
  encryptedRefreshToken: string;
  encryptedAccessToken: string;
  tokenExpiresAt: Date | null;
  status: GmailConnectionStatus;
  /** Whether this account is allowed to send (user toggle). */
  enabled: boolean;
  /** Max emails this account may send before stopping (0 = unlimited). */
  sendLimit: number;
  /** How many emails this account has sent since the last reset. */
  sentCount: number;
  /** Pacing: up to `throttlePerWindow` emails per `throttleWindowSeconds`. */
  throttlePerWindow: number;
  throttleWindowSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Client-safe view — never exposes token ciphertext. */
export interface PublicGmailConnection {
  id: string;
  gmailAddress: string;
  status: GmailConnectionStatus;
  enabled: boolean;
  sendLimit: number;
  sentCount: number;
  throttlePerWindow: number;
  throttleWindowSeconds: number;
  connectedAt: string;
}

/** Editable per-connection settings. */
export const connectionSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  sendLimit: z.number().int().min(0).max(100_000).optional(),
  throttlePerWindow: z.number().int().min(1).max(1000).optional(),
  throttleWindowSeconds: z.number().int().min(1).max(3600).optional(),
});

export type ConnectionSettingsInput = z.infer<typeof connectionSettingsSchema>;
