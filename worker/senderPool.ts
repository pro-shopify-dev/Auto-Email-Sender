import * as gmailRepo from "@/repositories/gmailRepo";
import type { GmailConnectionDoc } from "@/models/gmailConnection";

/**
 * Chooses which connected Gmail sends the next email for a given user, enforcing:
 *  - per-account cap (via DB `sentCount` vs `sendLimit`, checked by listEligibleSenders)
 *  - per-account pacing ("N emails per W seconds"), tracked in memory here
 *  - fair rotation (least-recently-used account first)
 *
 * Caps are persisted (survive restarts); pacing windows are per-process and reset on boot.
 */

interface PaceState {
  windowStart: number;
  count: number;
  lastUsed: number;
}

export type SenderPick =
  | { kind: "send"; connection: GmailConnectionDoc }
  | { kind: "rate-limited"; retryAfterMs: number }
  | { kind: "all-capped" }
  | { kind: "no-connections" };

export class SenderPool {
  private pace = new Map<string, PaceState>();

  /** Pick an eligible sender for this user, or explain why none is available. */
  async pick(userId: string): Promise<SenderPick> {
    const eligible = await gmailRepo.listEligibleSenders(userId);

    if (eligible.length === 0) {
      // Distinguish "nothing usable connected" from "usable accounts exist but are all
      // capped/paused". A capped account has status `limit_reached`; a paused one is
      // still `connected` but disabled — both count as usable (they could send again).
      const all = await gmailRepo.listByUser(userId);
      const anyUsable = all.some(
        (c) => c.status === "connected" || c.status === "limit_reached",
      );
      return anyUsable ? { kind: "all-capped" } : { kind: "no-connections" };
    }

    const now = Date.now();
    const ready: GmailConnectionDoc[] = [];
    let soonestFreeMs = Number.POSITIVE_INFINITY;

    for (const conn of eligible) {
      const windowMs = Math.max(1, conn.throttleWindowSeconds) * 1000;
      const state = this.pace.get(conn._id.toString());

      if (!state || now - state.windowStart >= windowMs) {
        ready.push(conn); // fresh window
        continue;
      }
      if (state.count < conn.throttlePerWindow) {
        ready.push(conn); // still has room in the current window
        continue;
      }
      // Blocked until this window ends.
      soonestFreeMs = Math.min(soonestFreeMs, state.windowStart + windowMs - now);
    }

    if (ready.length === 0) {
      return {
        kind: "rate-limited",
        retryAfterMs: Number.isFinite(soonestFreeMs) ? Math.max(250, soonestFreeMs) : 1000,
      };
    }

    // Rotate: least-recently-used account first.
    ready.sort((a, b) => {
      const la = this.pace.get(a._id.toString())?.lastUsed ?? 0;
      const lb = this.pace.get(b._id.toString())?.lastUsed ?? 0;
      return la - lb;
    });

    return { kind: "send", connection: ready[0]! };
  }

  /** Record that `connId` just sent, advancing its pacing window. */
  recordUse(conn: GmailConnectionDoc): void {
    const id = conn._id.toString();
    const now = Date.now();
    const windowMs = Math.max(1, conn.throttleWindowSeconds) * 1000;
    const state = this.pace.get(id);

    if (!state || now - state.windowStart >= windowMs) {
      this.pace.set(id, { windowStart: now, count: 1, lastUsed: now });
    } else {
      state.count += 1;
      state.lastUsed = now;
    }
  }
}
