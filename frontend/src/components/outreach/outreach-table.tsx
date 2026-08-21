"use client";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate } from "@/lib/format";
import type { Lead } from "@/lib/types";

// NOTE: Lead type has no direct `email` field (email lives on Contact/EmailDraft,
// not joined onto Lead by GET /api/leads), so the Email column shows an em dash.
// NOTE: Lead type has no `reply_date`/replied_at field, so Reply Date shows an em dash.
export function OutreachTable({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) return <EmptyState title="No leads found" />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Company</TableHead>
          <TableHead>Job</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Sent?</TableHead>
          <TableHead>Sent Date</TableHead>
          <TableHead>Reply?</TableHead>
          <TableHead>Reply Date</TableHead>
          <TableHead>Follow-up?</TableHead>
          <TableHead>Next Follow-up</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leads.map((l) => (
          <TableRow key={l.lead_id} className="cursor-pointer">
            <TableCell>
              <Link href={`/leads/${l.lead_id}`} className="font-medium text-indigo-600 hover:underline">
                {l.company_name || "—"}
              </Link>
            </TableCell>
            <TableCell>{l.job_title || "—"}</TableCell>
            <TableCell>—</TableCell>
            <TableCell>{l.email_sent ? "Yes" : "No"}</TableCell>
            <TableCell>{l.sent_at ? formatDate(l.sent_at) : "—"}</TableCell>
            <TableCell>{l.has_reply ? "Yes" : "No"}</TableCell>
            <TableCell>—</TableCell>
            <TableCell>{(l.follow_up_count ?? 0) > 0 ? "Yes" : "No"}</TableCell>
            <TableCell>{l.next_action_date ? formatDate(l.next_action_date) : "—"}</TableCell>
            <TableCell><StatusBadge status={l.status} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function leadsToCsvRows(leads: Lead[]): Record<string, unknown>[] {
  return leads.map((l) => ({
    company: l.company_name || "",
    job: l.job_title || "",
    sent: l.email_sent ? "Yes" : "No",
    sent_date: l.sent_at || "",
    reply: l.has_reply ? "Yes" : "No",
    follow_up: (l.follow_up_count ?? 0) > 0 ? "Yes" : "No",
    next_follow_up: l.next_action_date || "",
    status: l.status,
  }));
}
