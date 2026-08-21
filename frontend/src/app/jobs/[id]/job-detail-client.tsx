"use client";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Job } from "@/lib/types";
import { ArrowLeft, ExternalLink } from "lucide-react";

export function JobDetailClient({ id }: { id: string }) {
  const { data: job, error, isLoading } = useSWR<Job>(`/api/jobs/${id}`, fetcher);

  return (
    <div>
      <PageHeader
        title="Job Details"
        description={id}
        actions={
          <Link href="/jobs">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" /> Back to Jobs
            </Button>
          </Link>
        }
      />

      {error ? (
        <ErrorState message={error.message} />
      ) : isLoading ? null : !job ? (
        <EmptyState title="Job not found" />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{job.job_title}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Source" value={job.source} />
                <Field
                  label="Company"
                  value={
                    job.company_id ? (
                      <Link href={`/companies/${job.company_id}`} className="text-indigo-600 hover:underline">
                        {job.company_name || job.company_id}
                      </Link>
                    ) : (
                      job.company_name || "—"
                    )
                  }
                />
                <Field label="Location" value={job.location || "—"} />
                <Field label="City" value={job.city || "—"} />
                <Field label="State" value={job.state || "—"} />
                <Field label="Country" value={job.country || "—"} />
                <Field label="Experience" value={job.experience || "—"} />
                <Field label="Salary" value={job.salary || "—"} />
                <Field label="Employment Type" value={job.employment_type || "—"} />
                <Field label="Posted Date" value={formatDate(job.posted_date)} />
                <Field label="Skills" value={job.skills || "—"} />
                <Field label="Qualification" value={job.qualification || "—"} />
                <Field label="Extraction Confidence" value={job.extraction_confidence ?? "—"} />
                <Field
                  label="Qualified"
                  value={
                    job.is_qualified ? (
                      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Yes</Badge>
                    ) : (
                      <Badge className="border-gray-200 bg-gray-100 text-gray-600">No</Badge>
                    )
                  }
                />
                <Field label="Created" value={formatDateTime(job.created_at)} />
                <Field label="Updated" value={formatDateTime(job.updated_at)} />
              </dl>

              {job.description && (
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Description</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{job.description}</p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {job.job_url && (
                  <a href={job.job_url} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-3.5 w-3.5" /> Job Listing
                    </Button>
                  </a>
                )}
                {job.application_url && (
                  <a href={job.application_url} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-3.5 w-3.5" /> Apply
                    </Button>
                  </a>
                )}
                {job.source_url && (
                  <a href={job.source_url} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-3.5 w-3.5" /> Source
                    </Button>
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-800">{value}</dd>
    </div>
  );
}
