"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import { INDIAN_STATES, JOB_SOURCES } from "@/lib/indian-states";
import { Loader2, Search } from "lucide-react";

// Per user requirement: the search form only asks for Role + State. Every
// other search parameter (city, date filter, experience, sources, result
// limit) still exists on the backend and is sent with these fixed
// defaults — searching all configured sources, last 30 days, no location
// narrower than the state, and a result cap generous enough for a full
// automatic run (search auto-drafts + the pending-approval popup gates
// sending, so a larger default here just means more leads to review, not
// more emails sent automatically).
const DEFAULT_DATE_FILTER = "last_30_days";
const DEFAULT_RESULT_LIMIT = 50;
const DEFAULT_SOURCES = JOB_SOURCES.map((s) => s.value);

export default function SearchPage() {
  const router = useRouter();
  const { push } = useToast();

  const [jobTitle, setJobTitle] = useState("");
  const [state, setState] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post<{ run_id: string }>("/api/search", {
        job_title: jobTitle,
        state,
        city: "",
        date_filter: DEFAULT_DATE_FILTER,
        experience: "",
        sources: DEFAULT_SOURCES,
        result_limit: DEFAULT_RESULT_LIMIT,
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
      <PageHeader
        title="New Job Search"
        description="Search a role + state. Botivate automatically finds companies, drafts outreach emails, and asks you to confirm each one before sending."
      />

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Search Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="job_title">Role</Label>
              <Input
                id="job_title"
                className="mt-1"
                placeholder="e.g. MIS Executive"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                required
              />
            </div>

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

            <div className="pt-2">
              <Button type="submit" variant="primary" disabled={submitting || !jobTitle}>
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
