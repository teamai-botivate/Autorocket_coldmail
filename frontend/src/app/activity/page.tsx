"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { fetcher, qs } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import type { ActivityLogEntry, ListResponse } from "@/lib/types";
import {
  Activity as ActivityIcon, Mail, MessageSquareReply, CalendarClock, UserPlus,
  Building2, Briefcase, CheckCircle2, RefreshCw, Send, FileEdit, Ban,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  EMAIL_SENT: Send,
  EMAIL_QUEUED: Mail,
  EMAIL_DRAFTED: FileEdit,
  REPLY_RECEIVED: MessageSquareReply,
  FOLLOW_UP_SCHEDULED: CalendarClock,
  FOLLOW_UP_SENT: CalendarClock,
  LEAD_CREATED: UserPlus,
  LEAD_STATUS_CHANGED: RefreshCw,
  COMPANY_RESEARCHED: Building2,
  JOB_FOUND: Briefcase,
  STATUS_CHANGE: RefreshCw,
  COMPLETED: CheckCircle2,
  CANCELLED: Ban,
};

function iconFor(activityType: string | undefined | null): LucideIcon {
  if (!activityType) return ActivityIcon;
  return ICON_MAP[activityType] || ActivityIcon;
}

export default function ActivityPage() {
  const [activityType, setActivityType] = useState("");
  const [search, setSearch] = useState("");

  const queryString = qs({ activity_type: activityType || undefined });
  const { data, error, isLoading } = useSWR<ListResponse<ActivityLogEntry>>(`/api/activity${queryString}`, fetcher);

  const items = data?.items || [];

  const distinctTypes = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.activity_type) set.add(item.activity_type);
    }
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter((item) =>
      (item.description || "").toLowerCase().includes(q) ||
      (item.lead_id || "").toLowerCase().includes(q) ||
      (item.company_id || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  return (
    <div>
      <PageHeader
        title="Activity"
        description={isLoading ? "Loading…" : `${filteredItems.length} of ${data?.total ?? items.length} activity entries`}
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Select value={activityType || "ALL"} onValueChange={(v) => setActivityType(v === "ALL" ? "" : v)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              {distinctTypes.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Search description, lead or company id…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </CardContent>
      </Card>

      {error ? (
        <ErrorState message={error.message} />
      ) : !isLoading && filteredItems.length === 0 ? (
        <EmptyState title="No activity found" description="Try adjusting your filters." />
      ) : (
        <div className="space-y-0">
          {filteredItems.map((item, idx) => {
            const Icon = iconFor(item.activity_type);
            return (
              <div key={item.activity_id || idx} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white">
                    <Icon className="h-4 w-4 text-indigo-600" />
                  </div>
                  {idx < filteredItems.length - 1 && <div className="w-px flex-1 bg-slate-200" />}
                </div>
                <div className="flex-1 pb-6">
                  <div className="rounded-lg border border-slate-100 bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-800">{item.description || item.activity_type || "Activity"}</p>
                      <p className="shrink-0 text-xs text-slate-400">{formatDateTime(item.created_at)}</p>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {item.created_by && <span>By {item.created_by}</span>}
                      {item.lead_id && (
                        <Link href={`/leads/${item.lead_id}`} className="text-indigo-600 hover:underline">
                          Lead: {item.lead_id}
                        </Link>
                      )}
                      {item.company_id && <span>Company: {item.company_id}</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
