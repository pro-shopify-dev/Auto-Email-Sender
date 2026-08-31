"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Upload,
  MailCheck,
  Sparkles,
  FileText,
  Reply,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ContactForm } from "@/components/contacts/ContactForm";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";
import {
  CONTACT_STAGES,
  CONTACT_STAGE_LABELS,
  type ContactStage,
  type PublicContact,
} from "@/models/contact";

interface ListResponse {
  items: PublicContact[];
  total: number;
  page: number;
  pageSize: number;
  stageCounts: Record<ContactStage, number>;
}

/** Colour per stage: green = untouched and ready, blue = in flight, amber = needs attention. */
const stageVariant: Record<
  ContactStage,
  "success" | "secondary" | "warning" | "destructive"
> = {
  fresh: "success",
  in_draft: "secondary",
  sent: "secondary",
  replied: "success",
  bounced: "destructive",
  unsubscribed: "warning",
};

export default function ContactsPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PublicContact | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set("search", search);
      if (stage) params.set("stage", stage);
      const res = await apiFetch<ListResponse>(`/api/contacts?${params}`);
      setData(res);
    } catch (err) {
      toast.error("Failed to load contacts", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, stage]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  async function onDelete(c: PublicContact) {
    if (!confirm(`Delete ${c.email}?`)) return;
    try {
      await apiFetch(`/api/contacts/${c.id}`, { method: "DELETE" });
      toast.success("Contact deleted");
      load();
    } catch (err) {
      toast.error("Could not delete", (err as Error).message);
    }
  }

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Manage the people you send to."
        action={
          <>
            <Link href="/contacts/import">
              <Button variant="outline">
                <Upload className="h-4 w-4" /> Import CSV
              </Button>
            </Link>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> New contact
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, phone…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={stage}
          onChange={(e) => {
            setPage(1);
            setStage(e.target.value);
          }}
          className="w-full sm:w-48"
        >
          <option value="">All statuses</option>
          {CONTACT_STAGES.map((s) => (
            <option key={s} value={s}>
              {CONTACT_STAGE_LABELS[s]}
              {data ? ` (${data.stageCounts[s] ?? 0})` : ""}
            </option>
          ))}
        </Select>
      </div>

      {/* Pipeline at a glance — click a stage to filter by it. */}
      {data && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => {
              setPage(1);
              setStage("");
            }}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              stage === ""
                ? "border-primary bg-primary/10 font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            All{" "}
            {Object.values(data.stageCounts).reduce((a, b) => a + b, 0)}
          </button>
          {CONTACT_STAGES.map((s) => (
            <button
              key={s}
              onClick={() => {
                setPage(1);
                setStage(s);
              }}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                stage === s
                  ? "border-primary bg-primary/10 font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {CONTACT_STAGE_LABELS[s]} {data.stageCounts[s] ?? 0}
            </button>
          ))}
        </div>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!loading && data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No contacts yet. Create one or import a CSV.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              data?.items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    {`${c.firstName} ${c.lastName}`.trim() || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell className="text-muted-foreground">{c.phone || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.address || c.city || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant={stageVariant[c.stage]} className="gap-1">
                        {c.stage === "fresh" && <Sparkles className="h-3 w-3" />}
                        {c.stage === "in_draft" && <FileText className="h-3 w-3" />}
                        {c.stage === "sent" && <MailCheck className="h-3 w-3" />}
                        {c.stage === "replied" && <Reply className="h-3 w-3" />}
                        {CONTACT_STAGE_LABELS[c.stage]}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(c);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onDelete(c)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Card>

      {data && (
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPage(1);
            setPageSize(s);
          }}
        />
      )}

      {formOpen && (
        <ContactForm
          open={formOpen}
          onOpenChange={setFormOpen}
          contact={editing}
          onSaved={load}
        />
      )}
    </div>
  );
}
