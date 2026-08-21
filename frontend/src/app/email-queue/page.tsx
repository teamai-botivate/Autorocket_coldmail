"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { fetcher, qs } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { downloadCsv, formatDateTime } from "@/lib/format";
import type { EmailQueueItem, ListResponse, QueueStatus } from "@/lib/types";
import { Download } from "lucide-react";

const TABS: { value: string; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SENT", label: "Sent" },
  { value: "FAILED", label: "Failed" },
  { value: "RETRY", label: "Retry" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "SKIPPED", label: "Skipped" },
];

export default function EmailQueuePage() {
  return (
    <Suspense fallback={null}>
      <EmailQueuePageInner />
    </Suspense>
  );
}

function EmailQueuePageInner() {
  const sp = useSearchParams();
  const initial = sp.get("status")?.toUpperCase() || "ALL";
  const [status, setStatus] = useState<string>(TABS.some((t) => t.value === initial) ? initial : "ALL");

  const path = `/api/email-queue${qs(status === "ALL" ? {} : { status: status as QueueStatus })}`;
  const { data, error, isLoading } = useSWR<ListResponse<EmailQueueItem>>(path, fetcher);
  const items = data?.items ?? [];

  function csvRows() {
    return items.map((i) => ({
      recipient: i.recipient_email,
      subject: i.subject,
      status: i.status,
      scheduled_at: i.scheduled_at || "",
      attempts: `${i.attempts}/${i.max_attempts}`,
      last_error: i.error_message || "",
    }));
  }

  return (
    <div>
      <PageHeader
        title="Email Queue"
        description="Outbound send queue: pending, processing, sent, and failed emails"
        actions={
          <Button variant="outline" onClick={() => downloadCsv("email-queue.csv", csvRows())}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <div className="mb-4">
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList className="flex-wrap">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {error ? (
        <ErrorState message={error.message} />
      ) : (
        <Card>
          <CardContent className="pt-5">
            {isLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : items.length === 0 ? (
              <EmptyState title="No queue items found" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Queue Status</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Last Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((i) => (
                    <TableRow key={i.queue_id}>
                      <TableCell>
                        {/* LIMITATION: EmailQueueItem has no joined company field; only
                            recipient_email plus lead_id are available, so the recipient
                            cell links to the lead when lead_id is present. */}
                        {i.lead_id ? (
                          <Link href={`/leads/${i.lead_id}`} className="font-medium text-indigo-600 hover:underline">
                            {i.recipient_email}
                          </Link>
                        ) : (
                          i.recipient_email
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{i.subject || "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={i.status} />
                      </TableCell>
                      <TableCell>{formatDateTime(i.scheduled_at)}</TableCell>
                      <TableCell>{`${i.attempts ?? 0}/${i.max_attempts ?? 0}`}</TableCell>
                      <TableCell className="max-w-xs truncate" title={i.error_message || ""}>
                        {i.error_message || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
