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

export default function RepliedLeadsPage() {
  const { data, error, isLoading } = useSWR<ListResponse<Lead>>("/api/leads?reply_status=REPLIED", fetcher);
  const leads = data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Replied Leads"
        description="Leads that have replied to outreach"
        actions={
          <Button variant="outline" onClick={() => downloadCsv("replied-leads.csv", leadsToCsvRows(leads))}>
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
