"use client";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";
import type { Company } from "@/lib/types";
import { ExternalLink } from "lucide-react";

export function CompanyDetailClient({ id }: { id: string }) {
  const { data: company, error, isLoading } = useSWR<Company>(`/api/companies/${id}`, fetcher);

  return (
    <div>
      <PageHeader title="Company Details" description={id} />

      {error ? (
        <ErrorState message={error.message} />
      ) : isLoading ? null : !company ? (
        <EmptyState title="Company not found" />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{company.company_name}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Industry" value={company.industry || "—"} />
                <Field label="Location" value={[company.city, company.state, company.country].filter(Boolean).join(", ") || "—"} />
                <Field label="Phone" value={company.phone || "—"} />
                <Field
                  label="LinkedIn"
                  value={
                    company.linkedin_url ? (
                      <a href={company.linkedin_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                        View Profile
                      </a>
                    ) : (
                      "—"
                    )
                  }
                />
                <Field label="Research Status" value={<StatusBadge status={company.research_status} />} />
              </dl>

              {company.company_description && (
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Description</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{company.company_description}</p>
                </div>
              )}

              {company.official_website && (
                <div className="mt-4">
                  <a href={company.official_website} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-3.5 w-3.5" /> Open Website
                    </Button>
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <Tabs defaultValue="jobs">
                <TabsList>
                  <TabsTrigger value="jobs">Jobs</TabsTrigger>
                  <TabsTrigger value="contacts">Contacts</TabsTrigger>
                  <TabsTrigger value="leads">Leads</TabsTrigger>
                </TabsList>

                <TabsContent value="jobs">
                  {!company.jobs?.length ? (
                    <EmptyState title="No jobs for this company" />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Job Title</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Posted</TableHead>
                          <TableHead>Qualified</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {company.jobs.map((job) => (
                          <TableRow key={job.job_id}>
                            <TableCell>
                              <Link href={`/jobs/${job.job_id}`} className="font-medium text-indigo-600 hover:underline">
                                {job.job_title}
                              </Link>
                            </TableCell>
                            <TableCell>{job.location || "—"}</TableCell>
                            <TableCell>{formatDate(job.posted_date)}</TableCell>
                            <TableCell>{job.is_qualified ? "Yes" : "No"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="contacts">
                  {!company.contacts?.length ? (
                    <EmptyState title="No contacts for this company" />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Designation</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Verification</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {company.contacts.map((contact) => (
                          <TableRow key={contact.contact_id}>
                            <TableCell>{contact.contact_name || "—"}</TableCell>
                            <TableCell>{contact.designation || "—"}</TableCell>
                            <TableCell>{contact.email || "—"}</TableCell>
                            <TableCell>{contact.phone || "—"}</TableCell>
                            <TableCell>
                              <StatusBadge status={contact.verification_status} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="leads">
                  {!company.leads?.length ? (
                    <EmptyState title="No leads for this company" />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Job Title</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {company.leads.map((lead) => (
                          <TableRow key={lead.lead_id}>
                            <TableCell>
                              <Link href={`/leads/${lead.lead_id}`} className="font-medium text-indigo-600 hover:underline">
                                {lead.job_title || "—"}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={lead.status} />
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={lead.priority} />
                            </TableCell>
                            <TableCell>{lead.lead_score ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              </Tabs>
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
