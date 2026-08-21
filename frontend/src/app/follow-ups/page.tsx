"use client";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { fetcher, api, qs } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import { downloadCsv, formatDateTime } from "@/lib/format";
import { FollowUpEditDialog } from "@/components/follow-ups/follow-up-edit-dialog";
import type { FollowUp, FollowUpStatus, ListResponse } from "@/lib/types";
import { CalendarDays, Download } from "lucide-react";

type FilterChip = "today" | "tomorrow" | "this_week" | "next_7_days" | "overdue" | "custom";

const CHIPS: { value: FilterChip; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "this_week", label: "This Week" },
  { value: "next_7_days", label: "Next 7 Days" },
  { value: "overdue", label: "Overdue" },
  { value: "custom", label: "Custom" },
];

const STATUS_OPTIONS: FollowUpStatus[] = [
  "DRAFT",
  "SCHEDULED",
  "DUE",
  "QUEUED",
  "SENT",
  "CANCELLED",
  "SKIPPED",
  "FAILED",
];

export default function FollowUpsPage() {
  return (
    <Suspense fallback={null}>
      <FollowUpsPageInner />
    </Suspense>
  );
}

function FollowUpsPageInner() {
  const sp = useSearchParams();
  const initialFilter = (sp.get("filter") as FilterChip) || "today";
  const [chip, setChip] = useState<FilterChip>(CHIPS.some((c) => c.value === initialFilter) ? initialFilter : "today");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const { push } = useToast();

  const [editing, setEditing] = useState<FollowUp | null>(null);
  const [editFocusReschedule, setEditFocusReschedule] = useState(false);

  const params = useMemo(() => {
    const base: Record<string, string> =
      chip === "custom"
        ? { filter: "custom", date_from: dateFrom, date_to: dateTo }
        : { filter: chip };
    if (statusFilter) base.status = statusFilter;
    return base;
  }, [chip, dateFrom, dateTo, statusFilter]);

  const path = `/api/follow-ups${qs(params)}`;
  const shouldFetch = chip !== "custom" || (dateFrom && dateTo);
  const { data, error, isLoading, mutate } = useSWR<ListResponse<FollowUp>>(
    shouldFetch ? path : null,
    fetcher
  );
  const items = data?.items ?? [];

  const counts = useMemo(() => {
    const c: Record<string, number> = { DUE: 0, SCHEDULED: 0, OVERDUE: 0 };
    for (const f of items) {
      if (f.overdue) c.OVERDUE++;
      if (f.status === "DUE") c.DUE++;
      if (f.status === "SCHEDULED") c.SCHEDULED++;
    }
    return c;
  }, [items]);

  async function handleAction(id: string, action: "send-now" | "cancel" | "skip") {
    try {
      await api.post(`/api/follow-ups/${id}/${action}`);
      push({ title: `Follow-up ${action.replace("-", " ")} done`, variant: "success" });
      mutate();
    } catch (e) {
      push({ title: `Failed to ${action.replace("-", " ")}`, description: (e as Error).message, variant: "error" });
    }
  }

  function csvRows() {
    return items.map((f) => ({
      company: f.company_name || "",
      sequence: f.sequence_number,
      last_contact: f.created_at || "",
      next_follow_up: f.scheduled_at || "",
      status: f.status,
      overdue: f.overdue ? "Yes" : "No",
      reply: f.reply_received ? "Yes" : "No",
    }));
  }

  return (
    <div>
      <PageHeader
        title="Follow-ups"
        description="Manage scheduled and overdue follow-up emails"
        actions={
          <>
            <Link href="/follow-ups/calendar">
              <Button variant="outline">
                <CalendarDays className="h-4 w-4" /> Calendar View
              </Button>
            </Link>
            <Button variant="outline" onClick={() => downloadCsv("follow-ups.csv", csvRows())}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {CHIPS.map((c) => (
          <Button
            key={c.value}
            size="sm"
            variant={chip === c.value ? "primary" : "secondary"}
            onClick={() => setChip(c.value)}
          >
            {c.label}
          </Button>
        ))}
        <div className="ml-auto w-48">
          <Select value={statusFilter || "ALL"} onValueChange={(v) => setStatusFilter(v === "ALL" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {chip === "custom" && (
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">From</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">To</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          {!(dateFrom && dateTo) && (
            <p className="pb-2 text-xs text-slate-500">Pick both a start and end date to load results.</p>
          )}
        </div>
      )}

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-2xl font-semibold text-slate-900">{counts.DUE}</p>
            <p className="text-xs text-slate-500">Due (in current view)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-2xl font-semibold text-slate-900">{counts.SCHEDULED}</p>
            <p className="text-xs text-slate-500">Scheduled (in current view)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-2xl font-semibold text-slate-900">{counts.OVERDUE}</p>
            <p className="text-xs text-slate-500">Overdue (in current view)</p>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <ErrorState message={error.message} />
      ) : (
        <Card>
          <CardContent className="pt-5">
            {isLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : items.length === 0 ? (
              <EmptyState title="No follow-ups found" description="Try a different filter or date range." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Original Email</TableHead>
                    <TableHead>Sequence</TableHead>
                    <TableHead>Last Contact</TableHead>
                    <TableHead>Next Follow-up</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reply</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((f) => (
                    <TableRow key={f.follow_up_id}>
                      <TableCell>
                        <Link href={`/leads/${f.lead_id}`} className="font-medium text-indigo-600 hover:underline">
                          {f.company_name || "—"}
                        </Link>
                      </TableCell>
                      {/* LIMITATION: FollowUp type has no direct contact field. */}
                      <TableCell>—</TableCell>
                      <TableCell>
                        {f.sequence_number === 1 ? "Initial" : `Follow-up #${f.sequence_number - 1}`}
                      </TableCell>
                      <TableCell>{f.sequence_number}</TableCell>
                      <TableCell>{formatDateTime(f.created_at)}</TableCell>
                      <TableCell>{formatDateTime(f.scheduled_at)}</TableCell>
                      <TableCell>
                        <StatusBadge status={f.overdue ? "OVERDUE" : f.status} />
                      </TableCell>
                      <TableCell>{f.reply_received ? "Yes" : "No"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="success" onClick={() => handleAction(f.follow_up_id, "send-now")}>
                            Send Now
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditing(f);
                              setEditFocusReschedule(false);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditing(f);
                              setEditFocusReschedule(true);
                            }}
                          >
                            Reschedule
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => handleAction(f.follow_up_id, "skip")}>
                            Skip
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleAction(f.follow_up_id, "cancel")}
                          >
                            Cancel
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {editing && (
        <FollowUpEditDialog
          followUp={editing}
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(null)}
          onSaved={() => mutate()}
          focusReschedule={editFocusReschedule}
        />
      )}
    </div>
  );
}
