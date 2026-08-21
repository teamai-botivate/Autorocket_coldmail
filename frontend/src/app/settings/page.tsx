"use client";
import { useState } from "react";
import useSWR from "swr";
import { fetcher, api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import { formatDate } from "@/lib/format";
import type { EmailTemplate, ListResponse } from "@/lib/types";
import {
  Mail, Beaker, Sheet, Sparkles, Search, Repeat2, Layers, Gauge,
  Pencil, Copy, Power, Trash2, Plus,
} from "lucide-react";

interface SettingsEnv {
  email_test_mode: boolean;
  mock_mode: boolean;
  max_follow_ups: number;
  queue_batch_size: number;
  queue_max_attempts: number;
  sheets_configured: boolean;
  openai_configured: boolean;
  google_search_configured: boolean;
}

interface SettingsData {
  values: Record<string, string>;
  env: SettingsEnv;
}

// No FollowUpTemplate type exported in @/lib/types.ts — local interface matching the sheet schema.
interface FollowUpTemplate {
  template_id: string;
  name: string;
  sequence_number: number;
  subject: string;
  body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const TOGGLE_KEYS = ["AUTO_SEND", "AUTO_REPLY", "AUTO_FOLLOWUP_AUTOMATION"] as const;

function BoolCard({ label, value, icon: Icon }: { label: string; value: boolean | undefined; icon: React.ElementType }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-slate-300" />
      </div>
      <div className="mt-2">
        <Badge
          className={
            value
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-slate-50 text-slate-500"
          }
        >
          {value ? "ON" : "OFF"}
        </Badge>
      </div>
    </Card>
  );
}

const emptyTemplateForm = {
  name: "",
  category: "INITIAL" as EmailTemplate["category"],
  subject: "",
  plain_text_body: "",
  html_body: "",
};

export default function SettingsPage() {
  const { push } = useToast();
  const { data, error, isLoading, mutate } = useSWR<SettingsData>("/api/settings", fetcher);

  const [toggles, setToggles] = useState<Record<string, string> | null>(null);
  const [savingToggles, setSavingToggles] = useState(false);

  const currentToggles: Record<string, string> =
    toggles ?? {
      AUTO_SEND: data?.values?.AUTO_SEND ?? "false",
      AUTO_REPLY: data?.values?.AUTO_REPLY ?? "false",
      AUTO_FOLLOWUP_AUTOMATION: data?.values?.AUTO_FOLLOWUP_AUTOMATION ?? "false",
    };

  function setToggle(key: string, value: string) {
    setToggles({ ...currentToggles, [key]: value });
  }

  async function saveToggles() {
    setSavingToggles(true);
    try {
      await api.patch("/api/settings", {
        values: {
          AUTO_SEND: currentToggles.AUTO_SEND,
          AUTO_REPLY: currentToggles.AUTO_REPLY,
          AUTO_FOLLOWUP_AUTOMATION: currentToggles.AUTO_FOLLOWUP_AUTOMATION,
        },
      });
      push({ title: "Settings saved", variant: "success" });
      mutate();
    } catch (e) {
      push({ title: "Failed to save settings", description: (e as Error).message, variant: "error" });
    } finally {
      setSavingToggles(false);
    }
  }

  // Email templates
  const {
    data: templatesData,
    error: templatesError,
    mutate: mutateTemplates,
  } = useSWR<ListResponse<EmailTemplate>>("/api/email-templates", fetcher);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyTemplateForm);

  function openCreate() {
    setEditingId(null);
    setForm(emptyTemplateForm);
    setDialogOpen(true);
  }

  function openEdit(t: EmailTemplate) {
    setEditingId(t.template_id);
    setForm({
      name: t.name,
      category: t.category,
      subject: t.subject,
      plain_text_body: t.plain_text_body,
      html_body: t.html_body,
    });
    setDialogOpen(true);
  }

  async function submitTemplate() {
    try {
      if (editingId) {
        await api.patch(`/api/email-templates/${editingId}`, { ...form });
        push({ title: "Template updated", variant: "success" });
      } else {
        await api.post("/api/email-templates", {
          ...form,
          is_active: true,
          is_default: false,
        });
        push({ title: "Template created", variant: "success" });
      }
      setDialogOpen(false);
      setForm(emptyTemplateForm);
      setEditingId(null);
      mutateTemplates();
    } catch (e) {
      push({ title: "Failed to save template", description: (e as Error).message, variant: "error" });
    }
  }

  async function duplicateTemplate(id: string) {
    try {
      await api.post(`/api/email-templates/${id}/duplicate`);
      push({ title: "Template duplicated", variant: "success" });
      mutateTemplates();
    } catch (e) {
      push({ title: "Failed to duplicate template", description: (e as Error).message, variant: "error" });
    }
  }

  async function toggleActive(t: EmailTemplate) {
    try {
      await api.patch(`/api/email-templates/${t.template_id}`, { is_active: !t.is_active });
      push({ title: t.is_active ? "Template deactivated" : "Template activated", variant: "success" });
      mutateTemplates();
    } catch (e) {
      push({ title: "Failed to update template", description: (e as Error).message, variant: "error" });
    }
  }

  async function deleteTemplate(id: string) {
    if (!window.confirm("Delete this template? This cannot be undone.")) return;
    try {
      await api.delete(`/api/email-templates/${id}`);
      push({ title: "Template deleted", variant: "success" });
      mutateTemplates();
    } catch (e) {
      push({ title: "Failed to delete template", description: (e as Error).message, variant: "error" });
    }
  }

  // Follow-up templates (read-only)
  const { data: followUpTemplatesData, error: followUpTemplatesError } = useSWR<ListResponse<FollowUpTemplate>>(
    "/api/follow-up-templates",
    fetcher
  );

  if (error) return <ErrorState message={error.message} />;

  const env = data?.env;

  return (
    <div>
      <PageHeader title="Settings" description={isLoading ? "Loading…" : "System configuration and templates"} />

      {/* Env section */}
      <div className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Environment</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-4">
          <BoolCard label="Email Test Mode" value={env?.email_test_mode} icon={Beaker} />
          <BoolCard label="Mock Mode" value={env?.mock_mode} icon={Mail} />
          <BoolCard label="Sheets Configured" value={env?.sheets_configured} icon={Sheet} />
          <BoolCard label="OpenAI Configured" value={env?.openai_configured} icon={Sparkles} />
          <BoolCard label="Google Search Configured" value={env?.google_search_configured} icon={Search} />
          <MetricCard label="Max Follow-ups" value={env?.max_follow_ups ?? 0} icon={Repeat2} />
          <MetricCard label="Queue Batch Size" value={env?.queue_batch_size ?? 0} icon={Layers} />
          <MetricCard label="Queue Max Attempts" value={env?.queue_max_attempts ?? 0} icon={Gauge} />
        </div>
      </div>

      {/* Editable toggles */}
      <div className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Automation Settings</h2>
        <Card>
          <CardContent className="pt-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {TOGGLE_KEYS.map((key) => (
                <div key={key} className="space-y-1.5">
                  <Label>{key}</Label>
                  <Select value={currentToggles[key]} onValueChange={(v) => setToggle(key, v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">true</SelectItem>
                      <SelectItem value="false">false</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <Button variant="primary" onClick={saveToggles} disabled={savingToggles}>
                {savingToggles ? "Saving…" : "Save Settings"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email templates */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email Templates</h2>
          <Button size="sm" variant="primary" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Template
          </Button>
        </div>
        <Card>
          <CardContent className="pt-5">
            {templatesError ? (
              <ErrorState message={templatesError.message} />
            ) : !templatesData?.items?.length ? (
              <EmptyState title="No email templates yet" description="Create a template to get started." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Default</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templatesData.items.map((t) => (
                    <TableRow key={t.template_id}>
                      <TableCell className="font-medium text-slate-800">{t.name}</TableCell>
                      <TableCell>
                        <Badge className="border-indigo-200 bg-indigo-50 text-indigo-700">{t.category}</Badge>
                      </TableCell>
                      <TableCell className="max-w-55 truncate" title={t.subject}>
                        {t.subject}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            t.is_active
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-50 text-slate-500"
                          }
                        >
                          {t.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {t.is_default && (
                          <Badge className="border-amber-200 bg-amber-50 text-amber-700">Default</Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(t.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(t)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => duplicateTemplate(t.template_id)}
                            title="Duplicate"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleActive(t)}
                            title={t.is_active ? "Deactivate" : "Activate"}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteTemplate(t.template_id)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
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
      </div>

      {/* Follow-up templates (read-only) */}
      <div className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Follow-up Templates</h2>
        <Card>
          <CardContent className="pt-5">
            {followUpTemplatesError ? (
              <ErrorState message={followUpTemplatesError.message} />
            ) : !followUpTemplatesData?.items?.length ? (
              <EmptyState title="No follow-up templates yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Sequence #</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {followUpTemplatesData.items.map((t) => (
                    <TableRow key={t.template_id}>
                      <TableCell className="font-medium text-slate-800">{t.name}</TableCell>
                      <TableCell>{t.sequence_number}</TableCell>
                      <TableCell className="max-w-65 truncate" title={t.subject}>
                        {t.subject}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            t.is_active
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-50 text-slate-500"
                          }
                        >
                          {t.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(t.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit template dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Template" : "New Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v as EmailTemplate["category"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INITIAL">INITIAL</SelectItem>
                  <SelectItem value="FOLLOW_UP">FOLLOW_UP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Plain Text Body</Label>
              <Textarea
                rows={6}
                value={form.plain_text_body}
                onChange={(e) => setForm({ ...form, plain_text_body: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>HTML Body</Label>
              <Textarea
                rows={6}
                value={form.html_body}
                onChange={(e) => setForm({ ...form, html_body: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitTemplate}>
              {editingId ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
