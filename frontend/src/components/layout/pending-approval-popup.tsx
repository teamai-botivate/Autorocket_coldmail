"use client";

// Global "confirm before send" gate (user requirement: every email a search
// run drafts must be reviewed one-by-one, with editable subject/body, before
// anything is queued for actual sending). Search runs only ever create
// EMAIL_DRAFTS rows with status=DRAFT — they never auto-queue — so this
// component polls GET /api/emails/pending-approval and, whenever it's
// non-empty, blocks the app behind a modal showing exactly one draft at a
// time until the queue of pending drafts is empty.
import { useEffect, useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/lib/api";
import { EmailDraft } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const POLL_INTERVAL_MS = 15000;

export function PendingApprovalPopup() {
  const { data, mutate } = useSWR<{ items: EmailDraft[]; total: number }>(
    "/api/emails/pending-approval",
    fetcher,
    { refreshInterval: POLL_INTERVAL_MS, revalidateOnFocus: true }
  );

  const [current, setCurrent] = useState<EmailDraft | null>(null);
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queue = data?.items ?? [];

  useEffect(() => {
    if (!current && queue.length > 0) {
      const next = queue[0];
      setCurrent(next);
      setRecipient(next.recipient_email);
      setSubject(next.subject);
      setBody(next.plain_text_body);
      setError(null);
    }
    // If the currently-open draft got resolved elsewhere (e.g. edited/sent
    // from the Leads page in another tab), drop it and let the effect above
    // pick up the next one on the following poll.
    if (current && !queue.some((d) => d.email_id === current.email_id)) {
      setCurrent(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, current]);

  async function handleSend() {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/emails/${current.email_id}/send-now`, {
        recipient_email: recipient !== current.recipient_email ? recipient : undefined,
        subject: subject !== current.subject ? subject : undefined,
        plain_text_body: body !== current.plain_text_body ? body : undefined,
      });
      setCurrent(null);
      mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/emails/${current.email_id}/reject`, { reason: "Rejected from approval popup" });
      setCurrent(null);
      mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reject");
    } finally {
      setBusy(false);
    }
  }

  if (!current) return null;

  const remaining = queue.length;

  return (
    <Dialog open onOpenChange={() => { /* modal — no dismiss without a decision */ }}>
      <DialogContent
        className="max-w-2xl"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Confirm outreach email before sending</DialogTitle>
            {remaining > 1 && <Badge className="border-slate-200 bg-slate-100 text-slate-700">{remaining} pending</Badge>}
          </div>
          <DialogDescription>
            This email was auto-drafted from a job search result. Edit anything below, then Send or Reject.
            Nothing is sent to Apps Script&apos;s queue until you decide.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <Label>To</Label>
            <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} disabled={busy} />
          </div>
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={busy} />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              disabled={busy}
              className="font-mono text-xs"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleReject} disabled={busy}>
            Reject
          </Button>
          <Button onClick={handleSend} disabled={busy}>
            {busy ? "Sending..." : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
