"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/lib/api";
import type { FollowUp } from "@/lib/types";

function toLocalInputValue(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function FollowUpEditDialog({
  followUp,
  open,
  onOpenChange,
  onSaved,
  focusReschedule = false,
}: {
  followUp: FollowUp;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  focusReschedule?: boolean;
}) {
  const { push } = useToast();
  const [subject, setSubject] = useState(followUp.subject || "");
  const [body, setBody] = useState(followUp.body || "");
  const [scheduledAt, setScheduledAt] = useState(toLocalInputValue(followUp.scheduled_at));
  const [notes, setNotes] = useState(followUp.notes || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch(`/api/follow-ups/${followUp.follow_up_id}`, {
        subject,
        body,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        notes,
      });
      push({ title: "Follow-up updated", variant: "success" });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      push({ title: "Failed to update follow-up", description: (e as Error).message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{focusReschedule ? "Reschedule Follow-up" : "Edit Follow-up"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!focusReschedule && (
            <>
              <div className="space-y-1">
                <Label>Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Body</Label>
                <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
              </div>
            </>
          )}
          <div className="space-y-1">
            <Label>Scheduled At</Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
          {!focusReschedule && (
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
