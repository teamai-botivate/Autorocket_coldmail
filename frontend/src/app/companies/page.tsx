"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { fetcher, qs } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadCsv } from "@/lib/format";
import { INDIAN_STATES } from "@/lib/indian-states";
import type { Company, ListResponse } from "@/lib/types";
import { Download } from "lucide-react";

export default function CompaniesPage() {
  const router = useRouter();
  const [state, setState] = useState("");
  const [search, setSearch] = useState("");

  const query = qs({ state, search, limit: 200 });
  const { data, error, isLoading } = useSWR<ListResponse<Company>>(`/api/companies${query}`, fetcher);

  function handleExport() {
    if (!data?.items?.length) return;
    const rows = data.items.map((c) => ({
      company_id: c.company_id,
      company_name: c.company_name,
      industry: c.industry,
      city: c.city,
      state: c.state,
      official_website: c.official_website,
      research_status: c.research_status,
      phone: c.phone,
    }));
    downloadCsv("companies.csv", rows);
  }

  return (
    <div>
      <PageHeader
        title="Companies"
        description="Companies discovered from job listings"
        actions={
          <Button variant="outline" onClick={handleExport} disabled={!data?.items?.length}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

            <Input
              placeholder="Search company name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sm:col-span-2"
            />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <ErrorState message={error.message} />
      ) : isLoading ? null : !data?.items?.length ? (
        <EmptyState title="No companies found" description="Try adjusting the filters or run a new search." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Website</TableHead>
              <TableHead>Research Status</TableHead>
              <TableHead>Phone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((company) => (
              <TableRow
                key={company.company_id}
                className="cursor-pointer"
                onClick={() => router.push(`/companies/${company.company_id}`)}
              >
                <TableCell className="font-medium text-slate-800">{company.company_name}</TableCell>
                <TableCell>{company.industry || "—"}</TableCell>
                <TableCell>{[company.city, company.state].filter(Boolean).join(", ") || "—"}</TableCell>
                <TableCell>{company.official_website || "—"}</TableCell>
                <TableCell>
                  <StatusBadge status={company.research_status} />
                </TableCell>
                <TableCell>{company.phone || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
