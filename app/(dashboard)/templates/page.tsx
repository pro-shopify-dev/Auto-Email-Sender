"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, FileText, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import type { PublicTemplate } from "@/models/template";
import { TemplateEditor } from "@/components/templates/TemplateEditor";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<PublicTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<PublicTemplate | null | undefined>(undefined);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q),
    );
  }, [templates, search]);

  async function load() {
    setLoading(true);
    try {
      setTemplates(await apiFetch<PublicTemplate[]>("/api/templates"));
    } catch (err) {
      toast.error("Failed to load templates", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onDelete(t: PublicTemplate) {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    try {
      await apiFetch(`/api/templates/${t.id}`, { method: "DELETE" });
      toast.success("Template deleted");
      load();
    } catch (err) {
      toast.error("Could not delete", (err as Error).message);
    }
  }

  // editing === undefined -> list; null -> new; object -> edit
  if (editing !== undefined) {
    return (
      <TemplateEditor
        template={editing}
        onClose={() => setEditing(undefined)}
        onSaved={() => {
          setEditing(undefined);
          load();
        }}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Templates"
        description="Reusable emails with {{firstName}}-style variables."
        action={
          <Button onClick={() => setEditing(null)}>
            <Plus className="h-4 w-4" /> New template
          </Button>
        }
      />

      {templates.length > 0 && (
        <div className="mb-4 relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No templates yet</p>
            <Button onClick={() => setEditing(null)}>Create your first template</Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No templates match “{search}”.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <Card key={t.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="truncate">{t.name}</CardTitle>
                <p className="truncate text-sm text-muted-foreground">{t.subject}</p>
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <div className="flex flex-wrap gap-1">
                  {t.variables.length === 0 && (
                    <span className="text-xs text-muted-foreground">No variables</span>
                  )}
                  {t.variables.map((v) => (
                    <Badge key={v} variant="secondary">
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(t.updatedAt)}
                  </span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(t)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => onDelete(t)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
