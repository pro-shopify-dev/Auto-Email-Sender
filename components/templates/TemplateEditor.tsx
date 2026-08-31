"use client";

import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RichEditor } from "@/components/editor/RichEditor";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";
import { extractVariables, render, contactVariables } from "@/lib/template";
import type { PublicTemplate } from "@/models/template";

/** Sample data used for the live preview. */
const SAMPLE = contactVariables({
  firstName: "Alex",
  lastName: "Rivera",
  email: "alex@example.com",
  phone: "+1 555-0100",
  address: "123 Main St",
  city: "Austin",
  country: "USA",
});

export function TemplateEditor({
  template,
  onClose,
  onSaved,
}: {
  template: PublicTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [htmlBody, setHtmlBody] = useState(template?.htmlBody ?? "<p></p>");
  const [saving, setSaving] = useState(false);

  const variables = useMemo(
    () => extractVariables(subject, htmlBody),
    [subject, htmlBody],
  );

  const previewSubject = render(subject, SAMPLE);
  const previewHtml = render(htmlBody, SAMPLE);

  async function save() {
    if (!name.trim() || !subject.trim()) {
      toast.error("Name and subject are required");
      return;
    }
    setSaving(true);
    try {
      const payload = { name, subject, htmlBody, textBody: "" };
      if (template) {
        await apiFetch(`/api/templates/${template.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/templates", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      toast.success("Template saved");
      onSaved();
    } catch (err) {
      toast.error("Could not save", (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-semibold">
            {template ? "Edit template" : "New template"}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save template"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Template name</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Welcome email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-subject">Subject</Label>
            <Input
              id="tpl-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Hi {{firstName}}, welcome to {{company}}"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Body</Label>
            <RichEditor
              value={htmlBody}
              onChange={setHtmlBody}
              placeholder="Write your email…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Detected variables</Label>
            <div className="flex flex-wrap gap-1">
              {variables.length === 0 ? (
                <span className="text-sm text-muted-foreground">
                  Insert variables like {"{{firstName}}"}, {"{{company}}"}.
                </span>
              ) : (
                variables.map((v) => (
                  <Badge key={v} variant="secondary">{`{{${v}}}`}</Badge>
                ))
              )}
            </div>
          </div>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Live preview</CardTitle>
            <p className="text-xs text-muted-foreground">
              Rendered with sample contact data.
            </p>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border bg-muted/30 p-4">
              <p className="mb-2 border-b pb-2 text-sm font-medium">
                {previewSubject || "(no subject)"}
              </p>
              <div
                className="prose-sm max-w-none text-sm"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
