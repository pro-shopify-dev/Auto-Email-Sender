"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import type { PublicEmailJobDetail } from "@/models/emailJob";

export function EmailDetailDialog({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<PublicEmailJobDetail | null>(null);

  useEffect(() => {
    if (!id) return;
    setDetail(null);
    apiFetch<PublicEmailJobDetail>(`/api/history/${id}`)
      .then(setDetail)
      .catch((e) => {
        toast.error("Could not load email", (e as Error).message);
        onClose();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <Dialog open={Boolean(id)} onOpenChange={(o) => !o && onClose()}>
      <DialogHeader>
        <DialogTitle>Sent email</DialogTitle>
      </DialogHeader>

      {!detail ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="max-h-[70vh] space-y-3 overflow-y-auto text-sm">
          <Row label="From">{detail.fromAddress ?? <Muted>not sent yet</Muted>}</Row>
          <Row label="To">{detail.to}</Row>
          {detail.cc.length > 0 && <Row label="Cc">{detail.cc.join(", ")}</Row>}
          {detail.bcc.length > 0 && <Row label="Bcc">{detail.bcc.join(", ")}</Row>}
          <Row label="Template">
            {detail.templateName ?? <Muted>—</Muted>}
          </Row>
          <Row label="Subject">
            <span className="font-medium">{detail.subject}</span>
          </Row>
          <Row label="Status">
            <span className="flex items-center gap-2">
              <Badge>{detail.status}</Badge>
              {detail.repliedAt && <Badge variant="success">Replied</Badge>}
            </span>
          </Row>
          <Row label="When">{formatDate(detail.createdAt)}</Row>

          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Message
            </div>
            <div className="rounded-md border bg-muted/30 p-4">
              <div
                className="prose-sm max-w-none text-sm"
                dangerouslySetInnerHTML={{ __html: detail.htmlBody }}
              />
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[80px_1fr] items-start gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="break-words">{children}</span>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}
