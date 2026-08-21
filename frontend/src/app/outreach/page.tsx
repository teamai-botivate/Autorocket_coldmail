"use client";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { fetcher, qs } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadCsv } from "@/lib/format";
import { OutreachTable, leadsToCsvRows } from "@/components/outreach/outreach-table";
import type { Lead, ListResponse } from "@/lib/types";
import { Download } from "lucide-react";

const TABS = [
  "ALL",
  "DRAFTS",
  "APPROVED",
  "QUEUED",
  "SENT",
  "REPLIED",
  "FOLLOW-UP",
  "FAILED",
  "BOUNCED",
  "CLOSED",
] as const;
type Tab = (typeof TABS)[number];

// Maps each Outreach Overview tab to GET /api/leads query params.
// ASSUMPTION: FOLLOW-UP uses follow_up_status=FOLLOW_UP_SCHEDULED as a reasonable
// default (no single documented value maps 1:1 to "has an active follow-up").
// LIMITATION: LeadStatus has no FAILED value, and there's no server-side "failed
// send" concept on the Lead itself — true failed-email visibility lives on
// /email-queue?status=FAILED. The FAILED tab intentionally applies no extra
// lead-status filter here; a callout below links to the Email Queue instead.
function tabParams(tab: Tab): Record<string, string> {
  switch (tab) {
    case "ALL":
      return {};
    case "DRAFTS":
      return { status: "EMAIL_DRAFTED" };
    case "APPROVED":
      return { status: "APPROVED" };
    case "QUEUED":
      return { status: "QUEUED" };
    case "SENT":
      return { email_status: "SENT" };
    case "REPLIED":
      return { reply_status: "REPLIED" };
    case "FOLLOW-UP":
      return { follow_up_status: "FOLLOW_UP_SCHEDULED" };
    case "FAILED":
      return {};
    case "BOUNCED":
      return { status: "BOUNCED" };
    case "CLOSED":
      return { status: "CLOSED" };
  }
}

export default function OutreachPage() {
  return (
    <Suspense fallback={null}>
      <OutreachPageInner />
    </Suspense>
  );
}

function OutreachPageInner() {
  const sp = useSearchParams();
  const initialTab = (sp.get("tab")?.toUpperCase() as Tab) || "ALL";
  const [tab, setTab] = useState<Tab>(TABS.includes(initialTab) ? initialTab : "ALL");
  const [notSentOnly, setNotSentOnly] = useState(false);

  const params = useMemo(() => {
    const base = tabParams(tab);
    if (notSentOnly) return { ...base, email_status: "NOT_SENT" };
    return base;
  }, [tab, notSentOnly]);

  const path = `/api/leads${qs(params)}`;
  const { data, error, isLoading } = useSWR<ListResponse<Lead>>(path, fetcher);
  const leads = data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Outreach Overview"
        description="Track email drafts, sends, replies, and follow-ups across all leads"
        actions={
          <Button
            variant="outline"
            onClick={() => downloadCsv("outreach.csv", leadsToCsvRows(leads))}
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="flex-wrap">
            {TABS.map((t) => (
              <TabsTrigger key={t} value={t}>
                {t}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button
          variant={notSentOnly ? "primary" : "secondary"}
          size="sm"
          onClick={() => setNotSentOnly((v) => !v)}
        >
          {notSentOnly ? "Showing NOT SENT only ✕" : "NOT SENT"}
        </Button>
      </div>

      {tab === "FAILED" && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Lead status has no explicit &quot;failed&quot; value. For emails that actually failed to
          send, see{" "}
          <Link href="/email-queue?status=FAILED" className="font-medium underline">
            Email Queue → Failed
          </Link>
          .
        </div>
      )}

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
