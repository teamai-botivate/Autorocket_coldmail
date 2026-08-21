"use client";
import Link from "next/link";
import useSWR from "swr";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fetcher } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Campaign } from "@/lib/types";
import { ArrowLeft } from "lucide-react";

export function CampaignDetailClient({ id }: { id: string }) {
  const { data: campaign, error, isLoading } = useSWR<Campaign>(`/api/campaigns/${id}`, fetcher);

  if (error) return <ErrorState message={error.message} />;
  if (isLoading) return <div className="text-sm text-slate-500">Loading…</div>;
  if (!campaign) return <EmptyState title="Campaign not found" />;

  const funnel = campaign.funnel;
  const funnelData = funnel
    ? [
        { stage: "Jobs", value: funnel.jobs },
        { stage: "Leads", value: funnel.leads },
        { stage: "Emails Sent", value: funnel.emails_sent },
        { stage: "Replies", value: funnel.replies },
        { stage: "Interested", value: funnel.interested },
        { stage: "Meetings", value: funnel.meetings },
      ]
    : [];
  const hasFunnelData = funnelData.some((d) => d.value > 0);

  return (
    <div>
      <PageHeader
        title={campaign.name}
        description="Campaign details and funnel performance"
        actions={
          <Link href="/campaigns">
            <Button type="button" variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" /> Back to Campaigns
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Campaign Info</CardTitle>
              <StatusBadge status={campaign.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {campaign.description && <p className="text-slate-600">{campaign.description}</p>}
            <div className="grid grid-cols-2 gap-2 text-slate-600">
              <p><span className="font-medium text-slate-700">Job Title:</span> {campaign.job_title || "—"}</p>
              <p><span className="font-medium text-slate-700">State:</span> {campaign.state || "—"}</p>
              <p><span className="font-medium text-slate-700">City:</span> {campaign.city || "—"}</p>
              <p><span className="font-medium text-slate-700">Sources:</span> {campaign.sources || "—"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Funnel</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 280 }}>
            {!hasFunnelData ? (
              <EmptyState title="No funnel data yet" description="This campaign has no activity to report yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="stage" width={90} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#4f46e5" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
