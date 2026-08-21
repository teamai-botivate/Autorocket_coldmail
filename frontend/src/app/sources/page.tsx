"use client";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import type { ListResponse, SourceStatus } from "@/lib/types";
import { Check, X } from "lucide-react";

export default function SourcesPage() {
  const { data, error, isLoading } = useSWR<ListResponse<SourceStatus>>("/api/sources", fetcher);

  if (error) return <ErrorState message={error.message} />;

  return (
    <div>
      <PageHeader title="Sources" description="Configured job sources and their health" />

      {isLoading ? null : !data?.items?.length ? (
        <EmptyState title="No sources configured" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Display Name</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead>Last Status</TableHead>
              <TableHead>Last Checked</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((s) => (
              <TableRow key={s.source}>
                <TableCell className="font-medium text-slate-800">{s.source}</TableCell>
                <TableCell>{s.display_name}</TableCell>
                <TableCell>
                  {s.enabled ? (
                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                      <Check className="mr-1 h-3 w-3" /> Yes
                    </Badge>
                  ) : (
                    <Badge className="border-gray-200 bg-gray-100 text-gray-600">
                      <X className="mr-1 h-3 w-3" /> No
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={s.last_status} />
                </TableCell>
                <TableCell>{formatDateTime(s.last_checked_at)}</TableCell>
                <TableCell>{s.notes || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
