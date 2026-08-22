"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { api, fetcher } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { ErrorState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import { INDIAN_STATES, JOB_SOURCES } from "@/lib/indian-states";
import { Loader2, Search, Briefcase, Building2, Users, MailCheck, MessageSquareReply } from "lucide-react";
import type { DashboardData } from "@/lib/types";

// Simple, single-screen flow per user request: one search form to kick off
// a run, and a handful of top-line metrics. No follow-ups/replies/pipeline
// widgets here — all of that detail lives in the one Leads list page now.
const DEFAULT_DATE_FILTER = "last_30_days";
const FALLBACK_RESULT_LIMIT = 50;
const DEFAULT_SOURCES = JOB_SOURCES.map((s) => s.value);

export default function DashboardPage() {
  const router = useRouter();
  const { push } = useToast();
  const { data, error, isLoading } = useSWR<DashboardData>("/api/dashboard", fetcher, { refreshInterval: 30000 });

  const [jobTitle, setJobTitle] = useState("");
  const [state, setState] = useState("");
  const [resultLimit, setResultLimit] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const parsedLimit = parseInt(resultLimit, 10);
      const res = await api.post<{ run_id: string }>("/api/search", {
        job_title: jobTitle,
        state,
        city: "",
        date_filter: DEFAULT_DATE_FILTER,
        experience: "",
        sources: DEFAULT_SOURCES,
        result_limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : FALLBACK_RESULT_LIMIT,
      });
      if (!res?.run_id) {
        throw new Error("Backend did not return a run_id.");
      }
      push({ title: "Search started", description: "Leads will appear in the list below as they're found." });
      router.push("/leads");
    } catch (err) {
      push({
        title: "Failed to start search",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return <ErrorState message={error.message} />;

  const t = data?.totals || {};
  const today = data?.today || {};

  return (
    <div>
      <PageHeader title="Botivate Outreach" description={isLoading ? "Loading…" : "Search a role, and Botivate finds companies and sends outreach in the background."} />

      <Card className="mb-6 max-w-2xl">
        <CardHeader>
          <CardTitle>New Search</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="job_title">Role</Label>
              <Input
                id="job_title"
                className="mt-1"
                placeholder="e.g. MIS Executive"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                required
              />
            </div>

            <div className="flex-1">
              <Label>State</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Any state" />
                </SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-36">
              <Label htmlFor="result_limit">Results</Label>
              <Input
                id="result_limit"
                className="mt-1"
                type="number"
                min={1}
                placeholder="e.g. 50"
                value={resultLimit}
                onChange={(e) => setResultLimit(e.target.value)}
              />
            </div>

            <Button type="submit" variant="primary" disabled={submitting || !jobTitle}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Starting…
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" /> Search
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mb-2">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Today</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <MetricCard label="Jobs Found" value={today.jobs_found ?? 0} href="/leads" icon={Briefcase} />
          <MetricCard label="New Companies" value={today.new_companies ?? 0} href="/leads" icon={Building2} />
          <MetricCard label="New Leads" value={today.new_leads ?? 0} href="/leads" icon={Users} />
          <MetricCard label="Emails Sent" value={today.emails_sent ?? 0} href="/leads?email_status=SENT" icon={MailCheck} tone="success" />
          <MetricCard label="Replies" value={today.replies_received ?? 0} href="/leads?reply_status=REPLIED" icon={MessageSquareReply} />
        </div>
      </div>

      <div className="mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">All-Time</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <MetricCard label="Total Leads" value={t.total_leads ?? 0} href="/leads" icon={Users} />
          <MetricCard label="Emails Sent" value={t.emails_sent ?? 0} href="/leads?email_status=SENT" icon={MailCheck} tone="success" />
          <MetricCard label="Emails Queued" value={t.emails_queued ?? 0} href="/leads?email_status=QUEUED" icon={Search} />
          <MetricCard label="Replies Received" value={t.replies_received ?? 0} href="/leads?reply_status=REPLIED" icon={MessageSquareReply} />
          <MetricCard label="Companies" value={t.total_companies ?? 0} href="/leads" icon={Building2} />
        </div>
      </div>
    </div>
  );
}
