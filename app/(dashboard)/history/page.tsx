"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquareReply, Search, Ban, Trash2, Eye, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { EmailDetailDialog } from "@/components/history/EmailDetailDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import type { EmailJobStatus, PublicEmailJob } from "@/models/emailJob";

interface HistoryResult {
  items: PublicEmailJob[];
  total: number;
  page: number;
  pageSize: number;
}

const statusVariant: Record<
  EmailJobStatus,
  "default" | "success" | "warning" | "destructive"
> = {
  queued: "warning",
  processing: "warning",
  sent: "success",
  failed: "destructive",
  cancelled: "default",
};

export default function HistoryPage() {
  const [data, setData] = useState<HistoryResult | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [repliedOnly, setRepliedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      if (repliedOnly) params.set("replied", "1");
      setData(await apiFetch<HistoryResult>(`/api/history?${params}`));
    } catch (err) {
      toast.error("Failed to load history", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, status, repliedOnly]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  async function cancelJob(id: string) {
    try {
      await apiFetch(`/api/history/${id}?action=cancel`, { method: "POST" });
      toast.success("Email cancelled");
      load();
    } catch (err) {
      toast.error("Could not cancel", (err as Error).message);
    }
  }

  async function deleteJob(id: string) {
    if (!confirm("Delete this email record?")) return;
    try {
      await apiFetch(`/api/history/${id}`, { method: "DELETE" });
      toast.success("Record deleted");
      load();
    } catch (err) {
      toast.error("Could not delete", (err as Error).message);
    }
  }

  return (
    <div>
      <PageHeader title="History" description="Every email the worker has processed." />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search recipient or subject…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="w-full sm:w-44"
        >
          <option value="">All statuses</option>
          <option value="queued">Queued</option>
          <option value="processing">Processing</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
        <Button
          variant={repliedOnly ? "default" : "outline"}
          onClick={() => {
            setPage(1);
            setRepliedOnly((v) => !v);
          }}
        >
          Replied only
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>From → To</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>When</TableHead>
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
                  No email activity yet.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              data?.items.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="text-muted-foreground">
                        {job.fromAddress ?? "—"}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="font-medium">{job.to}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {job.templateName ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{job.subject}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={statusVariant[job.status]}>{job.status}</Badge>
                      {job.repliedAt && (
                        <Badge variant="success" className="gap-1">
                          <MessageSquareReply className="h-3 w-3" />
                          Replied{job.replyCount > 1 ? ` ×${job.replyCount}` : ""}
                        </Badge>
                      )}
                    </div>
                    {job.status === "failed" && job.lastError && (
                      <p className="mt-1 max-w-xs truncate text-xs text-destructive" title={job.lastError}>
                        {job.lastError}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(job.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="View email"
                        onClick={() => setDetailId(job.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {job.status === "queued" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Cancel (won't send)"
                          onClick={() => cancelJob(job.id)}
                        >
                          <Ban className="h-4 w-4 text-amber-600" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Delete record"
                        onClick={() => deleteJob(job.id)}
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

      <EmailDetailDialog id={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
