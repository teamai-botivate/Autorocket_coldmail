"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { fetcher, qs } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MonthCalendar } from "@/components/follow-ups/month-calendar";
import type { FollowUp, ListResponse } from "@/lib/types";
import { ArrowLeft } from "lucide-react";

// NOTE: the /api/follow-ups endpoint is documented for filter=today|tomorrow|
// this_week|next_7_days|overdue|custom. To cover an arbitrary visible month we
// use filter=custom with date_from/date_to spanning the first/last day of the
// displayed month (in local time, converted to ISO).
export default function FollowUpCalendarPage() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const { dateFrom, dateTo } = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
    return { dateFrom: first.toISOString(), dateTo: last.toISOString() };
  }, [month]);

  const path = `/api/follow-ups${qs({ filter: "custom", date_from: dateFrom, date_to: dateTo })}`;
  const { data, error, isLoading } = useSWR<ListResponse<FollowUp>>(path, fetcher);
  const items = data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Follow-up Calendar"
        description="Month view of scheduled and overdue follow-ups"
        actions={
          <Link href="/follow-ups">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" /> Back to Follow-ups
            </Button>
          </Link>
        }
      />
      {error ? (
        <ErrorState message={error.message} />
      ) : (
        <Card>
          <CardContent className="pt-5">
            {isLoading && <p className="mb-2 text-sm text-slate-500">Loading…</p>}
            <MonthCalendar followUps={items} month={month} onMonthChange={setMonth} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
