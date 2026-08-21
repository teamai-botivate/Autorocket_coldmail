"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { fetcher, qs } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, downloadCsv } from "@/lib/format";
import { INDIAN_STATES, JOB_SOURCES } from "@/lib/indian-states";
import type { Job, ListResponse } from "@/lib/types";
import { Download } from "lucide-react";

export default function JobsPage() {
  const router = useRouter();
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");

  const query = qs({ state, city, source, search, limit: 200 });
  const { data, error, isLoading } = useSWR<ListResponse<Job>>(`/api/jobs${query}`, fetcher);

  function handleExport() {
    if (!data?.items?.length) return;
    const rows = data.items.map((j) => ({
      job_id: j.job_id,
      source: j.source,
      job_title: j.job_title,
      company_name: j.company_name,
      location: j.location,
      city: j.city,
      state: j.state,
      experience: j.experience,
      salary: j.salary,
      posted_date: j.posted_date,
      is_qualified: j.is_qualified,
    }));
    downloadCsv("jobs.csv", rows);
  }

  return (
    <div>
      <PageHeader
        title="Jobs"
        description="Jobs discovered across all search runs"
        actions={
          <Button variant="outline" onClick={handleExport} disabled={!data?.items?.length}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Select value={state} onValueChange={setState}>
              <SelectTrigger>
                <SelectValue placeholder="Any state" />
              </SelectTrigger>
              <SelectContent>
                {INDIAN_STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />

            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue placeholder="Any source" />
              </SelectTrigger>
              <SelectContent>
                {JOB_SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input placeholder="Search job title/company" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <ErrorState message={error.message} />
      ) : isLoading ? null : !data?.items?.length ? (
        <EmptyState title="No jobs found" description="Try adjusting the filters or run a new search." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job Title</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Experience</TableHead>
              <TableHead>Posted</TableHead>
              <TableHead>Qualified</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((job) => (
              <TableRow
                key={job.job_id}
                className="cursor-pointer"
                onClick={() => router.push(`/jobs/${job.job_id}`)}
              >
                <TableCell className="font-medium text-slate-800">{job.job_title}</TableCell>
                <TableCell>{job.company_name}</TableCell>
                <TableCell>{job.source}</TableCell>
                <TableCell>{job.location || job.city || "—"}</TableCell>
                <TableCell>{job.experience || "—"}</TableCell>
                <TableCell>{formatDate(job.posted_date)}</TableCell>
                <TableCell>
                  {job.is_qualified ? (
                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Yes</Badge>
                  ) : (
                    <Badge className="border-gray-200 bg-gray-100 text-gray-600">No</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
