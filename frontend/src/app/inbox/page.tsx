"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { fetcher, qs } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime, humanize } from "@/lib/format";
import type { Reply, ReplyType, ListResponse } from "@/lib/types";

const REPLY_TYPES: ReplyType[] = [
  "INTERESTED", "REQUEST_FOR_DETAILS", "MEETING_REQUEST", "POSITIVE", "NEUTRAL",
  "NOT_INTERESTED", "ASK_LATER", "OUT_OF_OFFICE", "BOUNCE", "UNSUBSCRIBE", "UNKNOWN",
];

export default function InboxPage() {
  return (
    <Suspense fallback={null}>
      <InboxPageInner />
    </Suspense>
  );
}

function InboxPageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const replyType = sp.get("reply_type") || "";

  const queryString = qs({ reply_type: replyType || undefined });
  const { data, error, isLoading } = useSWR<ListResponse<Reply>>(`/api/replies${queryString}`, fetcher);

  const items = data?.items || [];

  function setReplyType(value: string) {
    const v = value === "ALL" ? "" : value;
    router.replace(`/inbox${qs({ reply_type: v || undefined })}`, { scroll: false });
  }

  return (
    <div>
      <PageHeader
        title="Inbox / Replies"
        description={isLoading ? "Loading…" : `${data?.total ?? items.length} replies`}
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Select value={replyType || "ALL"} onValueChange={setReplyType}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Filter by intent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              {REPLY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{humanize(t)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {error ? (
        <ErrorState message={error.message} />
      ) : !isLoading && items.length === 0 ? (
        <EmptyState title="No replies found" description="Try a different intent filter." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Intent</TableHead>
              <TableHead>Sentiment</TableHead>
              <TableHead>Lead Status</TableHead>
              <TableHead>Owner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow
                key={r.reply_id}
                className="cursor-pointer"
                onClick={() => router.push(`/inbox/${r.reply_id}`)}
              >
                <TableCell className="font-medium text-slate-800">{r.company_name || "—"}</TableCell>
                <TableCell>{r.from_email || "—"}</TableCell>
                <TableCell>{r.subject || "—"}</TableCell>
                <TableCell>{formatDateTime(r.received_at)}</TableCell>
                <TableCell><StatusBadge status={r.reply_type} /></TableCell>
                <TableCell><StatusBadge status={r.sentiment} /></TableCell>
                <TableCell>{r.lead_status ? <StatusBadge status={r.lead_status} /> : "—"}</TableCell>
                <TableCell>{r.owner || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
