"use client";
import useSWR from "swr";
import Link from "next/link";
import { fetcher } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatRelative, humanize } from "@/lib/format";
import type { DashboardData, FollowUp, Reply, Lead } from "@/lib/types";
import {
  Briefcase, Building2, Users, Mail, MailCheck, MailX, MessageSquareReply,
  CalendarClock, AlertCircle, Handshake, ThumbsDown, Ban, ShieldOff,
} from "lucide-react";

export default function DashboardPage() {
  const { data, error, isLoading } = useSWR<DashboardData>("/api/dashboard", fetcher, { refreshInterval: 30000 });
  const { data: followUps } = useSWR<{ items: FollowUp[] }>("/api/follow-ups?filter=today", fetcher);
  const { data: replies } = useSWR<{ items: Reply[] }>("/api/replies?limit=5", fetcher);
  const { data: leads } = useSWR<{ items: Lead[] }>("/api/leads?limit=8", fetcher);

  if (error) return <ErrorState message={error.message} />;

  const t = data?.totals || {};
  const today = data?.today || {};
  const alerts = data?.follow_up_alerts || { due_today: 0, overdue: 0, upcoming: 0 };

  return (
    <div>
      <PageHeader title="Botivate Outreach Command Center" description={isLoading ? "Loading…" : "Live figures from your Google Sheet database"} />

      <div className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Today</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          <MetricCard label="Jobs Found" value={today.jobs_found ?? 0} href="/jobs" icon={Briefcase} />
          <MetricCard label="New Companies" value={today.new_companies ?? 0} href="/companies" icon={Building2} />
          <MetricCard label="New Leads" value={today.new_leads ?? 0} href="/leads" icon={Users} />
          <MetricCard label="Emails Sent" value={today.emails_sent ?? 0} href="/outreach/sent" icon={MailCheck} tone="success" />
          <MetricCard label="Replies" value={today.replies_received ?? 0} href="/inbox" icon={MessageSquareReply} />
          <MetricCard label="Follow-ups Due" value={today.follow_ups_due ?? 0} href="/follow-ups" icon={CalendarClock} tone="warning" />
          <MetricCard label="Meetings Requested" value={today.meetings_requested ?? 0} href="/inbox?reply_type=MEETING_REQUEST" icon={Handshake} />
        </div>
      </div>

      <div className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">All-Time Totals</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <MetricCard label="Total Jobs" value={t.total_jobs ?? 0} href="/jobs" icon={Briefcase} />
          <MetricCard label="Qualified Jobs" value={t.total_qualified_jobs ?? 0} href="/jobs" icon={Briefcase} />
          <MetricCard label="Companies" value={t.total_companies ?? 0} href="/companies" icon={Building2} />
          <MetricCard label="Leads" value={t.total_leads ?? 0} href="/leads" icon={Users} />
          <MetricCard label="Emails Sent" value={t.emails_sent ?? 0} href="/outreach/sent" icon={MailCheck} tone="success" />
          <MetricCard label="Emails Failed" value={t.emails_failed ?? 0} href="/email-queue?status=FAILED" icon={MailX} tone="danger" />
          <MetricCard label="Emails Queued" value={t.emails_queued ?? 0} href="/email-queue?status=PENDING" icon={Mail} />
          <MetricCard label="Replies Received" value={t.replies_received ?? 0} href="/inbox" icon={MessageSquareReply} />
          <MetricCard label="Follow-ups Due" value={alerts.due_today ?? 0} href="/follow-ups?filter=today" icon={CalendarClock} tone="warning" />
          <MetricCard label="Overdue Follow-ups" value={alerts.overdue ?? 0} href="/follow-ups?filter=overdue" icon={AlertCircle} tone="danger" />
          <MetricCard label="Interested Leads" value={t.interested_leads ?? 0} href="/leads?status=INTERESTED" icon={Handshake} />
          <MetricCard label="Meetings" value={t.meeting_requests ?? 0} href="/leads?status=MEETING_REQUESTED" icon={Handshake} />
          <MetricCard label="Not Interested" value={t.not_interested ?? 0} href="/leads?status=NOT_INTERESTED" icon={ThumbsDown} />
          <MetricCard label="Bounced" value={t.bounced ?? 0} href="/leads?status=BOUNCED" icon={Ban} />
          <MetricCard label="Suppressed" value={t.suppressed ?? 0} href="/leads?status=SUPPRESSED" icon={ShieldOff} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Follow-ups</CardTitle>
          </CardHeader>
          <CardContent>
            {!followUps?.items?.length ? (
              <EmptyState title="No follow-ups due today" />
            ) : (
              <div className="space-y-2">
                {followUps.items.map((f) => (
                  <Link
                    key={f.follow_up_id}
                    href="/follow-ups"
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">{f.company_name || "Unknown company"}</p>
                      <p className="text-xs text-slate-500">Follow-up #{f.sequence_number}</p>
                    </div>
                    <StatusBadge status={f.overdue ? "OVERDUE" : f.status} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>New Replies</CardTitle>
          </CardHeader>
          <CardContent>
            {!replies?.items?.length ? (
              <EmptyState title="No replies yet" />
            ) : (
              <div className="space-y-2">
                {replies.items.map((r) => (
                  <Link
                    key={r.reply_id}
                    href={`/inbox/${r.reply_id}`}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">{r.company_name || r.from_email}</p>
                      <p className="text-xs text-slate-500">{formatRelative(r.received_at)}</p>
                    </div>
                    <StatusBadge status={r.reply_type} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Recent Outreach</CardTitle>
        </CardHeader>
        <CardContent>
          {!leads?.items?.length ? (
            <EmptyState title="No leads yet" description="Run a job search to start generating leads." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Sent?</TableHead>
                  <TableHead>Sent Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.items.map((l) => (
                  <TableRow key={l.lead_id}>
                    <TableCell>
                      <Link href={`/leads/${l.lead_id}`} className="font-medium text-indigo-600 hover:underline">
                        {l.company_name || "—"}
                      </Link>
                    </TableCell>
                    <TableCell>{l.job_title || "—"}</TableCell>
                    <TableCell>{l.email_sent ? "YES" : "NOT SENT"}</TableCell>
                    <TableCell>{l.sent_at ? formatDate(l.sent_at) : "—"}</TableCell>
                    <TableCell><StatusBadge status={l.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.pipeline || Object.keys(data.pipeline).length === 0 ? (
            <EmptyState title="No pipeline data yet" />
          ) : (
            <div className="flex flex-wrap gap-3">
              {Object.entries(data.pipeline).map(([status, count]) => (
                <div key={status} className="rounded-lg border border-slate-100 px-3 py-2 text-center">
                  <p className="text-lg font-semibold text-slate-800">{count}</p>
                  <p className="text-xs text-slate-500">{humanize(status)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
