import { vi, describe, it, expect, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import type { GmailConnectionDoc } from "@/models/gmailConnection";

// Mutable state the mocked repo reads from (vitest allows `mock`-prefixed names in factories).
const mockState: { eligible: GmailConnectionDoc[]; all: GmailConnectionDoc[] } = {
  eligible: [],
  all: [],
};

vi.mock("@/repositories/gmailRepo", () => ({
  listEligibleSenders: vi.fn(async () => mockState.eligible),
  listByUser: vi.fn(async () => mockState.all),
}));

import { SenderPool } from "@/worker/senderPool";

function conn(overrides: Partial<GmailConnectionDoc> = {}): GmailConnectionDoc {
  return {
    _id: new ObjectId(),
    userId: new ObjectId(),
    gmailAddress: "x@example.com",
    encryptedRefreshToken: "",
    encryptedAccessToken: "",
    tokenExpiresAt: null,
    status: "connected",
    enabled: true,
    sendLimit: 100,
    sentCount: 0,
    throttlePerWindow: 1,
    throttleWindowSeconds: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("SenderPool", () => {
  beforeEach(() => {
    mockState.eligible = [];
    mockState.all = [];
  });

  it("returns no-connections when nothing is connected", async () => {
    const pool = new SenderPool();
    const pick = await pool.pick("u");
    expect(pick.kind).toBe("no-connections");
  });

  it("returns all-capped when connected accounts exist but none are eligible", async () => {
    mockState.eligible = [];
    mockState.all = [conn({ status: "limit_reached" })];
    const pool = new SenderPool();
    const pick = await pool.pick("u");
    expect(pick.kind).toBe("all-capped");
  });

  it("rotates across accounts, then rate-limits when all windows are full", async () => {
    const a = conn({ throttlePerWindow: 1, throttleWindowSeconds: 10 });
    const b = conn({ throttlePerWindow: 1, throttleWindowSeconds: 10 });
    mockState.eligible = [a, b];
    const pool = new SenderPool();

    const first = await pool.pick("u");
    expect(first.kind).toBe("send");
    if (first.kind === "send") pool.recordUse(first.connection);

    // Second pick should choose the *other* account (round-robin), not the one just used.
    const second = await pool.pick("u");
    expect(second.kind).toBe("send");
    if (second.kind === "send") {
      expect(second.connection._id.toString()).not.toBe(
        first.kind === "send" ? first.connection._id.toString() : "",
      );
      pool.recordUse(second.connection);
    }

    // Both accounts have now used their single slot in the window -> rate-limited.
    const third = await pool.pick("u");
    expect(third.kind).toBe("rate-limited");
    if (third.kind === "rate-limited") {
      expect(third.retryAfterMs).toBeGreaterThan(0);
      expect(third.retryAfterMs).toBeLessThanOrEqual(10_000);
    }
  });

  it("allows multiple sends within the window when throttlePerWindow > 1", async () => {
    const a = conn({ throttlePerWindow: 3, throttleWindowSeconds: 10 });
    mockState.eligible = [a];
    const pool = new SenderPool();

    for (let i = 0; i < 3; i++) {
      const p = await pool.pick("u");
      expect(p.kind).toBe("send");
      if (p.kind === "send") pool.recordUse(p.connection);
    }
    // 4th within the same window is blocked.
    expect((await pool.pick("u")).kind).toBe("rate-limited");
  });
});
