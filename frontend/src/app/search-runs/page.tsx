"use client";
import Link from "next/link";
import useSWR from "swr";
import { fetcher, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import type { ListResponse, SearchRun } from "@/lib/types";
import { Plus } from "lucide-react";

export default function SearchRunsPage() {
  const { data, error, isLoading } = useSWR<ListResponse<SearchRun>>("/api/search", fetcher);

  return (
    <div>
      <PageHeader
        title="Search Runs"
        description="History of job search runs"
        actions={
          <Link href="/search">
            <Button variant="primary">
              <Plus className="h-4 w-4" /> New Search
            </Button>
          </Link>
        }
      />

      {isLoading ? null : error ? (
        isNotFoundError(error) ? (
          <EmptyState
            title="Search run history is not available"
            description="The backend does not currently expose a list of past search runs."
          />
        ) : (
          <ErrorState message={error.message} />
        )
      ) : !data?.items?.length ? (
        <EmptyState title="No search runs yet" description="Start a new search to see it appear here." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Run ID</TableHead>
              <TableHead>Query</TableHead>
              <TableHead>Sources</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Results</TableHead>
              <TableHead>Qualified</TableHead>
              <TableHead>Companies</TableHead>
              <TableHead>Emails</TableHead>
              <TableHead>Leads</TableHead>
              <TableHead>Started</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((run) => (
              <TableRow key={run.run_id}>
                <TableCell>
                  <Link href={`/search/${run.run_id}`} className="font-medium text-indigo-600 hover:underline">
                    {run.run_id}
                  </Link>
                </TableCell>
                <TableCell>{run.query || run.job_title || "—"}</TableCell>
                <TableCell>{run.sources || "—"}</TableCell>
                <TableCell>
                  <StatusBadge status={run.status} />
                </TableCell>
                <TableCell>{run.results ?? 0}</TableCell>
                <TableCell>{run.qualified ?? 0}</TableCell>
                <TableCell>{run.companies ?? 0}</TableCell>
                <TableCell>{run.emails ?? 0}</TableCell>
                <TableCell>{run.leads ?? 0}</TableCell>
                <TableCell>{formatDateTime(run.started_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function isNotFoundError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 404 || error.status === 0 || error.status === 501;
  }
  return true;
}
