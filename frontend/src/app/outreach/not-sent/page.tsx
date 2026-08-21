"use client";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/format";
import { OutreachTable, leadsToCsvRows } from "@/components/outreach/outreach-table";
import type { Lead, ListResponse } from "@/lib/types";
import { Download } from "lucide-react";

export default function NotSentPage() {
  const { data, error, isLoading } = useSWR<ListResponse<Lead>>("/api/leads?email_status=NOT_SENT", fetcher);
  const leads = data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Not Sent"
        description="Leads whose outreach email has not been sent yet"
        actions={
          <Button variant="outline" onClick={() => downloadCsv("not-sent.csv", leadsToCsvRows(leads))}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />
      {error ? (
        <ErrorState message={error.message} />
      ) : (
        <Card>
          <CardContent className="pt-5">
            {isLoading ? <p className="text-sm text-slate-500">Loading…</p> : <OutreachTable leads={leads} />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
