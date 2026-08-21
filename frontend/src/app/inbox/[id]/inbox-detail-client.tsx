"use client";
import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { formatDateTime } from "@/lib/format";
import type { Reply, Conversation, ConversationMessage, FollowUp } from "@/lib/types";
import { ConversationThread } from "@/components/inbox/conversation-thread";
import { Copy, Pencil, Send, CalendarClock, RefreshCw } from "lucide-react";

interface ConversationResponse {
  lead_id: string;
  messages: ConversationMessage[];
  follow_ups: FollowUp[];
  conversation: Conversation;
}

export function InboxDetailClient({ id }: { id: string }) {
  const toast = useToast();
  const { data: reply, error, isLoading } = useSWR<Reply>(`/api/replies/${id}`, fetcher);

  const { data: convo, error: convoError, isLoading: convoLoading } = useSWR<ConversationResponse>(
    reply ? `/api/conversations/${reply.lead_id}` : null,
    fetcher
  );

  const [editing, setEditing] = useState(false);
  const [editedText, setEditedText] = useState("");

  if (error) return <ErrorState message={error.message} />;
  if (isLoading) return <div className="text-sm text-slate-500">Loading…</div>;
  if (!reply) return <EmptyState title="Reply not found" />;

  function startEditing() {
    setEditedText(reply?.suggested_response || "");
    setEditing(true);
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.push({ title: "Copied to clipboard", variant: "success" });
    } catch {
      toast.push({ title: "Could not copy", variant: "error" });
    }
  }

  return (
    <div>
      <PageHeader
        title="Reply Detail"
        description={reply.subject || reply.from_email}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Conversation Thread</CardTitle>
            </CardHeader>
            <CardContent>
              {convoError ? (
                <ErrorState message={convoError.message} />
              ) : convoLoading ? (
                <div className="text-sm text-slate-500">Loading conversation…</div>
              ) : !convo?.messages?.length ? (
                <EmptyState title="No messages in this conversation yet" />
              ) : (
                <ConversationThread messages={convo.messages} />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Reply Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">From</p>
                <p className="text-slate-800">{reply.from_name ? `${reply.from_name} <${reply.from_email}>` : reply.from_email || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Received</p>
                <p className="text-slate-800">{formatDateTime(reply.received_at)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Subject</p>
                <p className="text-slate-800">{reply.subject || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Intent</p>
                <StatusBadge status={reply.reply_type} />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Sentiment</p>
                <StatusBadge status={reply.sentiment} />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">AI Summary</p>
                <p className="italic text-slate-600">{reply.ai_summary || "—"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Suggested Response</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!reply.suggested_response ? (
                <EmptyState title="No suggested response available" />
              ) : editing ? (
                <>
                  <Textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    rows={8}
                  />
                  <p className="text-xs text-slate-400">
                    Editing here does not save automatically — copy your edited text when ready.
                  </p>
                </>
              ) : (
                <p className="whitespace-pre-wrap text-sm text-slate-700">{reply.suggested_response}</p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(editing ? editedText : reply.suggested_response || "")}
                  disabled={!reply.suggested_response}
                >
                  <Copy className="h-4 w-4" /> Copy
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => (editing ? setEditing(false) : startEditing())}
                  disabled={!reply.suggested_response}
                >
                  <Pencil className="h-4 w-4" /> {editing ? "Done Editing" : "Edit"}
                </Button>
                <span title="Sending must be done manually — automatic sending from replies is not supported">
                  <Button type="button" variant="primary" size="sm" disabled>
                    <Send className="h-4 w-4" /> Send
                  </Button>
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-wrap gap-2 p-4">
              <Link href={`/leads/${reply.lead_id}`}>
                <Button type="button" variant="outline" size="sm">
                  <CalendarClock className="h-4 w-4" /> Schedule Follow-up
                </Button>
              </Link>
              <Link href={`/leads/${reply.lead_id}`}>
                <Button type="button" variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4" /> Change Status
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
