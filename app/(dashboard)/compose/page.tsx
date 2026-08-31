"use client";

import { useEffect, useState } from "react";
import { Send, FlaskConical, Save, Eye, Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TagInput } from "@/components/ui/tag-input";
import { RichEditor } from "@/components/editor/RichEditor";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";
import { isValidEmail } from "@/lib/utils";

const DRAFT_KEY = "compose-draft-v1";

export default function ComposePage() {
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("<p></p>");
  const [scheduledAt, setScheduledAt] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [busy, setBusy] = useState(false);

  // Restore any saved draft on mount.
  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      setTo(d.to ?? []);
      setCc(d.cc ?? []);
      setBcc(d.bcc ?? []);
      setSubject(d.subject ?? "");
      setHtmlBody(d.htmlBody ?? "<p></p>");
      setScheduledAt(d.scheduledAt ?? "");
    } catch {
      /* ignore malformed draft */
    }
  }, []);

  function saveDraft() {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ to, cc, bcc, subject, htmlBody, scheduledAt }),
    );
    toast.success("Draft saved", "Restored automatically next time you open Compose.");
  }

  function validate(requireRecipients: boolean): boolean {
    if (requireRecipients && to.length === 0) {
      toast.error("Add at least one recipient");
      return false;
    }
    const bad = [...to, ...cc, ...bcc].find((e) => !isValidEmail(e));
    if (bad) {
      toast.error("Invalid email address", bad);
      return false;
    }
    if (!subject.trim()) {
      toast.error("Subject is required");
      return false;
    }
    return true;
  }

  async function submit(test: boolean) {
    if (!validate(!test)) return;
    setBusy(true);
    try {
      const payload = {
        to,
        cc,
        bcc,
        subject,
        htmlBody,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        test,
      };
      await apiFetch("/api/send", { method: "POST", body: JSON.stringify(payload) });
      toast.success(
        test ? "Test email queued" : scheduledAt ? "Email scheduled" : "Email queued",
        "The worker will deliver it shortly.",
      );
      if (!test) {
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch (err) {
      toast.error("Could not send", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Compose"
        description="Send a one-off email through your connected Gmail."
        action={
          <>
            <Button variant="outline" onClick={saveDraft}>
              <Save className="h-4 w-4" /> Save draft
            </Button>
            <Button variant="outline" onClick={() => setShowPreview((s) => !s)}>
              <Eye className="h-4 w-4" /> {showPreview ? "Hide" : "Preview"}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1.5">
              <Label>To</Label>
              <TagInput value={to} onChange={setTo} placeholder="recipient@example.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cc</Label>
                <TagInput value={cc} onChange={setCc} placeholder="cc@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Bcc</Label>
                <TagInput value={bcc} onChange={setBcc} placeholder="bcc@example.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <RichEditor value={htmlBody} onChange={setHtmlBody} placeholder="Write your email…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="schedule" className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Schedule (optional)
              </Label>
              <Input
                id="schedule"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => submit(false)} disabled={busy}>
                <Send className="h-4 w-4" />
                {scheduledAt ? "Schedule" : "Send now"}
              </Button>
              <Button variant="outline" onClick={() => submit(true)} disabled={busy}>
                <FlaskConical className="h-4 w-4" /> Send test to myself
              </Button>
            </div>
          </CardContent>
        </Card>

        {showPreview && (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border bg-muted/30 p-4">
                <div className="mb-2 space-y-0.5 border-b pb-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">To:</span> {to.join(", ") || "—"}
                  </p>
                  <p className="font-medium">{subject || "(no subject)"}</p>
                </div>
                <div
                  className="prose-sm max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: htmlBody }}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
