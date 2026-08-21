"use client";
import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, fetcher } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toaster";
import { INDIAN_STATES, JOB_SOURCES } from "@/lib/indian-states";
import type { Campaign, EmailTemplate, ListResponse } from "@/lib/types";
import { Plus } from "lucide-react";

export default function CampaignsPage() {
  const toast = useToast();
  const { data, error, isLoading, mutate } = useSWR<ListResponse<Campaign>>("/api/campaigns", fetcher);
  const { data: templatesData } = useSWR<ListResponse<EmailTemplate>>("/api/email-templates", fetcher);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const templates = templatesData?.items || [];
  const items = data?.items || [];

  function toggleSource(value: string) {
    setSources((prev) => (prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]));
  }

  function resetForm() {
    setName("");
    setDescription("");
    setJobTitle("");
    setState("");
    setCity("");
    setSources([]);
    setTemplateId("");
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.push({ title: "Campaign name is required", variant: "error" });
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/campaigns", {
        name,
        description,
        job_title: jobTitle,
        state,
        city,
        sources: sources.join(","),
        template_id: templateId,
      });
      toast.push({ title: "Campaign created", variant: "success" });
      mutate();
      setOpen(false);
      resetForm();
    } catch (e) {
      toast.push({ title: "Failed to create campaign", description: (e as Error).message, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description={isLoading ? "Loading…" : `${data?.total ?? items.length} campaigns`}
        actions={
          <Button type="button" variant="primary" size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New Campaign
          </Button>
        }
      />

      {error ? (
        <ErrorState message={error.message} />
      ) : !isLoading && items.length === 0 ? (
        <EmptyState title="No campaigns yet" description="Create your first campaign to get started." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <Link key={c.campaign_id} href={`/campaigns/${c.campaign_id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{c.name}</CardTitle>
                    <StatusBadge status={c.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-slate-600">
                  {c.description && <p className="line-clamp-2 text-slate-500">{c.description}</p>}
                  <div className="grid grid-cols-2 gap-1 text-xs text-slate-500">
                    <p><span className="font-medium text-slate-600">Job Title:</span> {c.job_title || "—"}</p>
                    <p><span className="font-medium text-slate-600">State:</span> {c.state || "—"}</p>
                    <p><span className="font-medium text-slate-600">City:</span> {c.city || "—"}</p>
                    <p><span className="font-medium text-slate-600">Sources:</span> {c.sources || "—"}</p>
                  </div>
                  {c.funnel && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded bg-slate-100 px-2 py-0.5">Jobs: {c.funnel.jobs}</span>
                      <span className="rounded bg-slate-100 px-2 py-0.5">Leads: {c.funnel.leads}</span>
                      <span className="rounded bg-slate-100 px-2 py-0.5">Sent: {c.funnel.emails_sent}</span>
                      <span className="rounded bg-slate-100 px-2 py-0.5">Replies: {c.funnel.replies}</span>
                      <span className="rounded bg-slate-100 px-2 py-0.5">Interested: {c.funnel.interested}</span>
                      <span className="rounded bg-slate-100 px-2 py-0.5">Meetings: {c.funnel.meetings}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New Campaign</DialogTitle>
            <DialogDescription>Define targeting criteria for this outreach campaign.</DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Job Title</label>
              <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Sales Manager" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">State</label>
                <Select value={state || undefined} onValueChange={setState}>
                  <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">City</label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Sources</label>
              <div className="grid grid-cols-2 gap-2">
                {JOB_SOURCES.map((s) => (
                  <label key={s.value} className="flex items-center gap-2 text-sm text-slate-700">
                    <Checkbox
                      checked={sources.includes(s.value)}
                      onCheckedChange={() => toggleSource(s.value)}
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Email Template</label>
              {templates.length === 0 ? (
                <Input
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  placeholder="Template ID (no templates found to select from)"
                />
              ) : (
                <Select value={templateId || undefined} onValueChange={setTemplateId}>
                  <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.template_id} value={t.template_id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" variant="primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Creating…" : "Create Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
