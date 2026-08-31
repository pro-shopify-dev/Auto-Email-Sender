import { describe, it, expect } from "vitest";
import { planReconcile } from "@/services/draftPoolService";
import { canManageDrafts } from "@/repositories/gmailRepo";
import type { GmailConnectionDoc } from "@/models/gmailConnection";

describe("planReconcile", () => {
  it("creates the shortfall when below target", () => {
    expect(planReconcile(0, 300)).toEqual({ toCreate: 300, toDelete: 0 });
    expect(planReconcile(299, 300)).toEqual({ toCreate: 1, toDelete: 0 });
  });

  it("does nothing when already at target", () => {
    expect(planReconcile(300, 300)).toEqual({ toCreate: 0, toDelete: 0 });
  });

  it("trims extras when the target is lowered", () => {
    expect(planReconcile(320, 300)).toEqual({ toCreate: 0, toDelete: 20 });
  });

  it("treats a negative target as zero", () => {
    expect(planReconcile(2, -1)).toEqual({ toCreate: 0, toDelete: 2 });
  });

  it("replaces exactly the drafts that left the folder", () => {
    // 300 target, 3 sent by hand + 2 deleted => 295 alive => refill 5.
    expect(planReconcile(295, 300)).toEqual({ toCreate: 5, toDelete: 0 });
  });
});

describe("canManageDrafts", () => {
  const connection = (status: GmailConnectionDoc["status"]) =>
    ({ status }) as GmailConnectionDoc;

  it("keeps drafts active when the automatic sending cap is reached", () => {
    expect(canManageDrafts(connection("connected"))).toBe(true);
    expect(canManageDrafts(connection("limit_reached"))).toBe(true);
  });

  it("excludes accounts whose authorization cannot manage drafts", () => {
    expect(canManageDrafts(connection("revoked"))).toBe(false);
    expect(canManageDrafts(connection("error"))).toBe(false);
  });
});
