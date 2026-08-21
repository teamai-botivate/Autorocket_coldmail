"use client";
import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { fetcher, qs } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, EmptyState } from "@/components/shared/empty-state";
import { MetricCard } from "@/components/shared/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AnalyticsData } from "@/lib/types";
import { Percent, ThumbsUp, Handshake, Users, Send } from "lucide-react";

type RangeKey = "today" | "7" | "30" | "90" | "custom";

function recordToChartData(rec: Record<string, number> | undefined): { name: string; value: number }[] {
  if (!rec) return [];
  return Object.entries(rec).map(([name, value]) => ({ name, value }));
}

function sortedByDate(rec: Record<string, number> | undefined): { name: string; value: number }[] {
  if (!rec) return [];
  return Object.entries(rec)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, value]) => ({ name, value }));
}

function asPercent(value: number | undefined): string {
  if (value === undefined || value === null || isNaN(value)) return "—";
  const pct = value > 1 ? value : value * 100;
  return `${pct.toFixed(1)}%`;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<RangeKey>("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { dateFrom, dateTo } = useMemo(() => {
    const now = new Date();
    if (range === "today") {
      const from = isoDate(now);
      return { dateFrom: from, dateTo: from };
    }
    if (range === "7" || range === "30" || range === "90") {
      const days = Number(range);
      const from = new Date(now);
      from.setDate(from.getDate() - days);
      return { dateFrom: isoDate(from), dateTo: isoDate(now) };
    }
    // custom
    return { dateFrom: customFrom || undefined, dateTo: customTo || undefined };
  }, [range, customFrom, customTo]);

  const queryString = qs({ date_from: dateFrom, date_to: dateTo });
  const { data, error, isLoading } = useSWR<AnalyticsData>(`/api/analytics${queryString}`, fetcher);

  return (
    <div>
      <PageHeader title="Analytics" description={isLoading ? "Loading…" : "Outreach performance overview"} />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <Button type="button" size="sm" variant={range === "today" ? "secondary" : "ghost"} onClick={() => setRange("today")}>Today</Button>
          <Button type="button" size="sm" variant={range === "7" ? "secondary" : "ghost"} onClick={() => setRange("7")}>7 days</Button>
          <Button type="button" size="sm" variant={range === "30" ? "secondary" : "ghost"} onClick={() => setRange("30")}>30 days</Button>
          <Button type="button" size="sm" variant={range === "90" ? "secondary" : "ghost"} onClick={() => setRange("90")}>90 days</Button>
          <Button type="button" size="sm" variant={range === "custom" ? "secondary" : "ghost"} onClick={() => setRange("custom")}>Custom</Button>
          {range === "custom" && (
            <div className="flex items-center gap-2">
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <span className="text-xs text-slate-400">to</span>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          )}
        </CardContent>
      </Card>

      {error ? (
        <ErrorState message={error.message} />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            <MetricCard label="Reply Rate" value={asPercent(data?.reply_rate)} icon={Percent} />
            <MetricCard label="Positive Reply Rate" value={asPercent(data?.positive_reply_rate)} icon={ThumbsUp} />
            <MetricCard label="Meeting Rate" value={asPercent(data?.meeting_rate)} icon={Handshake} />
            <MetricCard label="Total Leads" value={data?.total_leads ?? 0} icon={Users} />
            <MetricCard label="Total Sent" value={data?.total_sent ?? 0} icon={Send} />
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartCard title="Leads by State" data={recordToChartData(data?.leads_by_state)} type="bar" />
            <ChartCard title="Leads by Source" data={recordToChartData(data?.leads_by_source)} type="bar" />
            <ChartCard title="Leads by Job Title" data={recordToChartData(data?.leads_by_job_title)} type="bar" />
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartCard title="Emails by Day" data={sortedByDate(data?.emails_by_day)} type="line" />
            <ChartCard title="Replies by Day" data={sortedByDate(data?.replies_by_day)} type="line" />
            <ChartCard title="Follow-ups by Day" data={sortedByDate(data?.follow_ups_by_day)} type="line" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="Opportunity Score Distribution" data={recordToChartData(data?.opportunity_score_distribution)} type="bar" />
            <ChartCard title="Pipeline" data={recordToChartData(data?.pipeline)} type="bar" />
          </div>
        </>
      )}
    </div>
  );
}

function ChartCard({
  title,
  data,
  type,
}: {
  title: string;
  data: { name: string; value: number }[];
  type: "bar" | "line";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent style={{ height: 260 }}>
        {data.length === 0 ? (
          <EmptyState title="No data yet" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {type === "bar" ? (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} dot={false} />
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
