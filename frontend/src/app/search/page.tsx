"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import { INDIAN_STATES, JOB_SOURCES } from "@/lib/indian-states";
import { Loader2, Search } from "lucide-react";

const DATE_FILTERS: { value: string; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "this_month", label: "This Month" },
  { value: "custom", label: "Custom" },
];

export default function SearchPage() {
  const router = useRouter();
  const { push } = useToast();

  const [jobTitle, setJobTitle] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [dateFilter, setDateFilter] = useState("last_7_days");
  const [experience, setExperience] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [resultLimit, setResultLimit] = useState(50);
  const [submitting, setSubmitting] = useState(false);

  function toggleSource(value: string) {
    setSources((prev) => (prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post<{ run_id: string }>("/api/search", {
        job_title: jobTitle,
        state,
        city,
        date_filter: dateFilter,
        experience,
        sources,
        result_limit: resultLimit,
      });
      if (!res?.run_id) {
        throw new Error("Backend did not return a run_id.");
      }
      router.push(`/search/${res.run_id}`);
    } catch (err) {
      push({
        title: "Failed to start search",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="New Job Search" description="Search for jobs across configured sources and generate leads." />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Search Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="job_title">Job Title</Label>
              <Input
                id="job_title"
                className="mt-1"
                placeholder="e.g. Operations Manager"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>State</Label>
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger className="mt-1">
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
              </div>

              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  className="mt-1"
                  placeholder="e.g. Mumbai"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Date Posted</Label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select date filter" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FILTERS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="experience">Experience</Label>
                <Input
                  id="experience"
                  className="mt-1"
                  placeholder="e.g. 2-5 years"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Sources</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {JOB_SOURCES.map((s) => (
                  <label key={s.value} className="flex items-center gap-2 text-sm text-slate-700">
                    <Checkbox checked={sources.includes(s.value)} onCheckedChange={() => toggleSource(s.value)} />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="max-w-[200px]">
              <Label htmlFor="result_limit">Result Limit</Label>
              <Input
                id="result_limit"
                type="number"
                min={1}
                className="mt-1"
                value={resultLimit}
                onChange={(e) => setResultLimit(Number(e.target.value))}
              />
            </div>

            <div className="pt-2">
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Starting Search…
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" /> Start Search
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
