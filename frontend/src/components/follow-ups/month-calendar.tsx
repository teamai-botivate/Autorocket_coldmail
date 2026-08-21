"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { statusColor, formatDateTime } from "@/lib/format";
import type { FollowUp } from "@/lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function MonthCalendar({
  followUps,
  month,
  onMonthChange,
}: {
  followUps: FollowUp[];
  month: Date;
  onMonthChange: (month: Date) => void;
}) {
  const [openDay, setOpenDay] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, FollowUp[]>();
    for (const f of followUps) {
      if (!f.scheduled_at) continue;
      const d = new Date(f.scheduled_at);
      if (isNaN(d.getTime())) continue;
      const key = dayKey(d);
      const arr = map.get(key) || [];
      arr.push(f);
      map.set(key, arr);
    }
    return map;
  }, [followUps]);

  const cells = useMemo(() => {
    const year = month.getFullYear();
    const m = month.getMonth();
    const firstOfMonth = new Date(year, m, 1);
    const startOffset = firstOfMonth.getDay();
    const gridStart = new Date(year, m, 1 - startOffset);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
    }
    return days;
  }, [month]);

  const today = dayKey(new Date());

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="w-40 text-center text-sm font-semibold text-slate-900">
            {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
          <Button size="icon" variant="outline" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button size="sm" variant="secondary" onClick={() => onMonthChange(new Date())}>
          Today
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
        {WEEKDAYS.map((w) => (
          <div key={w} className="bg-slate-50 px-2 py-1.5 text-center text-xs font-semibold uppercase text-slate-500">
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          const key = dayKey(d);
          const inMonth = d.getMonth() === month.getMonth();
          const dayItems = byDay.get(key) || [];
          const visible = dayItems.slice(0, 3);
          const extra = dayItems.length - visible.length;
          return (
            <div
              key={i}
              className={`min-h-[92px] bg-white p-1.5 ${inMonth ? "" : "bg-slate-50/60 text-slate-400"} ${
                key === today ? "ring-2 ring-inset ring-indigo-400" : ""
              }`}
            >
              <p className={`mb-1 text-xs font-medium ${inMonth ? "text-slate-700" : "text-slate-400"}`}>
                {d.getDate()}
              </p>
              <div className="space-y-0.5">
                {visible.map((f) => (
                  <div
                    key={f.follow_up_id}
                    className={`truncate rounded border px-1 py-0.5 text-[10px] font-medium ${statusColor(
                      f.overdue ? "OVERDUE" : f.status
                    )}`}
                    title={`${f.company_name || "Unknown"} — ${f.subject || ""}`}
                  >
                    {f.company_name || f.subject || "Follow-up"}
                  </div>
                ))}
                {(extra > 0 || dayItems.length > 0) && (
                  <Popover open={openDay === key} onOpenChange={(o) => setOpenDay(o ? key : null)}>
                    <PopoverTrigger asChild>
                      {extra > 0 ? (
                        <button className="text-[10px] font-medium text-indigo-600 hover:underline">
                          +{extra} more
                        </button>
                      ) : (
                        <button className="text-[10px] text-slate-400 hover:underline">view</button>
                      )}
                    </PopoverTrigger>
                    <PopoverContent className="w-72">
                      <p className="mb-2 text-xs font-semibold text-slate-500">
                        {d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                      </p>
                      <div className="max-h-64 space-y-2 overflow-y-auto">
                        {dayItems.map((f) => (
                          <Link
                            key={f.follow_up_id}
                            href={`/leads/${f.lead_id}`}
                            className="block rounded-lg border border-slate-100 px-2 py-1.5 hover:bg-slate-50"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-xs font-medium text-slate-800">
                                {f.company_name || "Unknown company"}
                              </p>
                              <StatusBadge status={f.overdue ? "OVERDUE" : f.status} />
                            </div>
                            <p className="mt-0.5 truncate text-xs text-slate-500">{f.subject || "(no subject)"}</p>
                            <p className="text-[10px] text-slate-400">{formatDateTime(f.scheduled_at)}</p>
                          </Link>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
