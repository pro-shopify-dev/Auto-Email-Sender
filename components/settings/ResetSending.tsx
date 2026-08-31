"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";

/** "Start fresh" — clears everyone's emailed mark, deletes history, resets Gmail counters. */
export function ResetSending() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function reset() {
    if (
      !confirm(
        "Start fresh?\n\nThis marks EVERY contact as active + not-yet-emailed, deletes ALL send history, and resets each Gmail's counter. Contacts, templates, and connected Gmails are kept.\n\nAfter this, Start will email your whole list again.",
      )
    )
      return;
    setBusy(true);
    try {
      const res = await apiFetch<{ contactsReset: number; historyDeleted: number }>(
        "/api/send/reset",
        { method: "POST" },
      );
      toast.success(
        "Reset complete",
        `${res.contactsReset} contacts set to unsent · ${res.historyDeleted} history rows cleared.`,
      );
      router.refresh();
    } catch (err) {
      toast.error("Could not reset", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="destructive" onClick={reset} disabled={busy}>
      <RotateCcw className="h-4 w-4" />
      {busy ? "Resetting…" : "Start fresh (reset all)"}
    </Button>
  );
}
