"use client";
import { useEffect, useRef, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { apiBase, fetcher } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import type { SearchRun } from "@/lib/types";

const TRACKED_EVENTS = [
  "search_progress",
  "source_status",
  "job_found",
  "company_found",
  "email_found",
  "lead_created",
  "email_generated",
] as const;

type LogEntry = {
  id: number;
  event: string;
  timestamp: string;
  payload: Record<string, unknown>;
};

type SourceInfo = {
  status?: string;
  count?: number;
};

const TERMINAL_STATUSES = ["COMPLETED", "FAILED", "CANCELLED"];

export function SearchRunClient({ id }: { id: string }) {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [sourceInfo, setSourceInfo] = useState<Record<string, SourceInfo>>({});
  const [counts, setCounts] = useState<Record<string, number>>({
    job_found: 0,
    company_found: 0,
    email_found: 0,
    lead_created: 0,
    email_generated: 0,
  });
  const logIdRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: run, error, mutate } = useSWR<SearchRun>(`/api/search/${id}`, fetcher, {
    refreshInterval: 0,
  });

  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;

    function startPolling() {
      if (pollRef.current) return;
      pollRef.current = setInterval(async () => {
        try {
          const latest = await mutate();
          if (latest?.status && TERMINAL_STATUSES.includes(latest.status)) {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
        } catch {
          // ignore transient polling errors
        }
      }, 8000);
    }

    try {
      es = new EventSource(`${apiBase()}/api/search/${id}/stream`);

      const appendLog = (event: string) => (e: MessageEvent) => {
        if (cancelled) return;
        let payload: Record<string, unknown> = {};
        try {
          payload = JSON.parse(e.data);
        } catch {
          payload = { raw: e.data };
        }
        logIdRef.current += 1;
        setLog((prev) => [
          { id: logIdRef.current, event, timestamp: new Date().toISOString(), payload },
          ...prev,
        ]);

        if (event === "source_status") {
          const source = String(payload.source ?? payload.name ?? "unknown");
          setSourceInfo((prev) => ({
            ...prev,
            [source]: {
              status: (payload.status as string) ?? prev[source]?.status,
              count: (payload.count as number) ?? prev[source]?.count,
            },
          }));
        } else if (
          event === "job_found" ||
          event === "company_found" ||
          event === "email_found" ||
          event === "lead_created" ||
          event === "email_generated"
        ) {
          setCounts((prev) => ({ ...prev, [event]: (prev[event] ?? 0) + 1 }));
          if (event === "email_generated") {
            // A new outreach email was just drafted for this search run.
            // Nudge the global pending-approval popup to refetch right now
            // instead of waiting for its own poll interval, so the "ask
            // before every send" popup appears immediately during an
            // active search rather than up to ~15s later.
            globalMutate("/api/emails/pending-approval");
          }
        }
      };

      for (const evt of TRACKED_EVENTS) {
        es.addEventListener(evt, appendLog(evt));
      }

      es.addEventListener("done", () => {
        if (cancelled) return;
        mutate();
        es?.close();
      });

      es.onerror = () => {
        if (cancelled) return;
        es?.close();
        startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      cancelled = true;
      es?.close();
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const streamDone = !!(run?.status && TERMINAL_STATUSES.includes(run.status));

  useEffect(() => {
    if (streamDone && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [streamDone]);

  if (error) return <ErrorState message={error.message} />;

  const showSummary = run?.status === "COMPLETED" || run?.status === "FAILED";

  return (
    <div>
      <PageHeader
        title="Search Run"
        description={`Run ID: ${id}`}
        actions={run?.status ? <StatusBadge status={run.status} /> : undefined}
      />

      {showSummary && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
              <SummaryItem label="Query" value={run?.query || run?.job_title || "—"} />
              <SummaryItem label="Sources" value={run?.sources || "—"} />
              <SummaryItem label="Status" value={<StatusBadge status={run?.status} />} />
              <SummaryItem label="Results" value={run?.results ?? 0} />
              <SummaryItem label="Qualified" value={run?.qualified ?? 0} />
              <SummaryItem label="Companies" value={run?.companies ?? 0} />
              <SummaryItem label="Emails" value={run?.emails ?? 0} />
              <SummaryItem label="Leads" value={run?.leads ?? 0} />
              <SummaryItem label="Started" value={formatDateTime(run?.started_at)} />
              <SummaryItem label="Completed" value={formatDateTime(run?.completed_at)} />
            </div>
            {run?.status === "FAILED" && run?.error_message && (
              <p className="mt-3 text-sm text-red-600">{run.error_message}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Source Status</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(sourceInfo).length === 0 ? (
            <EmptyState title="No source updates yet" />
          ) : (
            <div className="flex flex-wrap gap-3">
              {Object.entries(sourceInfo).map(([source, info]) => (
                <div key={source} className="rounded-lg border border-slate-100 px-3 py-2 text-center">
                  <p className="text-sm font-medium text-slate-800">{source}</p>
                  <p className="text-xs text-slate-500">
                    {info.status ? <StatusBadge status={info.status} /> : "—"}
                    {info.count !== undefined ? ` · ${info.count}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Event Counts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Object.entries(counts).map(([key, val]) => (
              <div key={key} className="rounded-lg border border-slate-100 px-3 py-2 text-center">
                <p className="text-lg font-semibold text-slate-800">{val}</p>
                <p className="text-xs text-slate-500">{key.replace(/_/g, " ")}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live Log{streamDone ? " (finished)" : ""}</CardTitle>
        </CardHeader>
        <CardContent>
          {log.length === 0 ? (
            <EmptyState title="Waiting for search to start…" />
          ) : (
            <div className="max-h-[32rem] space-y-2 overflow-y-auto">
              {log.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-slate-100 px-3 py-2 text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium text-slate-800">{entry.event}</span>
                    <span className="text-slate-400">{formatDateTime(entry.timestamp)}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-slate-600">
                    {Object.entries(entry.payload).map(([k, v]) => (
                      <span key={k}>
                        <span className="text-slate-400">{k}:</span> {String(v)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 text-sm text-slate-800">{value}</div>
    </div>
  );
}
