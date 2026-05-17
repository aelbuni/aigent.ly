import { getSubmissionById } from "@/lib/admin-queries";
import Image from "next/image";
import {
  approveAndOnboard,
  rejectSubmission,
  startReview,
  updateOnboardingStep,
  updateReviewNotes,
} from "@/features/admin-submissions/actions/submission-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Circle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "destructive",
  under_review: "default",
  approved: "secondary",
  rejected: "outline",
  onboarding: "default",
  live: "secondary",
};

const ONBOARDING_STEPS: { key: string; label: string }[] = [
  { key: "stack_record_created", label: "Stack record created" },
  { key: "logo_uploaded", label: "Logo uploaded" },
  { key: "rules_assigned", label: "Rules assigned" },
  { key: "threats_synced", label: "Threats synced" },
  { key: "coverage_areas_filled", label: "Coverage areas filled" },
  { key: "published", label: "Published (launch)" },
];

export default async function SubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getSubmissionById(id);
  if (!data) notFound();

  const { submission: sub, submitter } = data;
  const progress: Record<string, boolean> = {
    stack_record_created:  sub.stepStackCreated,
    logo_uploaded:         sub.stepLogoUploaded,
    rules_assigned:        sub.stepRulesAssigned,
    threats_synced:        sub.stepThreatsSynced,
    coverage_areas_filled: sub.stepCoverageFilled,
    published:             sub.stepPublished,
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{sub.proposedName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={STATUS_VARIANTS[sub.status] ?? "outline"}>{sub.status.replace(/_/g, " ")}</Badge>
            <span className="text-sm text-muted-foreground">{sub.proposedSlug}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {sub.status === "pending" && (
            <form action={startReview.bind(null, id)}>
              <Button type="submit" variant="outline" size="sm">Start Review</Button>
            </form>
          )}
          {(sub.status === "pending" || sub.status === "under_review") && (
            <>
              <form action={approveAndOnboard.bind(null, id)}>
                <Button type="submit" size="sm">Approve & Onboard</Button>
              </form>
              <form action={async () => { "use server"; await rejectSubmission(id, ""); }}>
                <Button type="submit" variant="destructive" size="sm">Reject</Button>
              </form>
            </>
          )}
          {sub.linkedStackId && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/stacks/${sub.linkedStackId}`}>
                View Stack <ExternalLink className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Submission Details</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div><span className="font-medium text-muted-foreground">Ecosystem</span><p>{sub.ecosystem ?? "—"}</p></div>
            <div><span className="font-medium text-muted-foreground">Submitted</span><p>{new Date(sub.createdAt).toLocaleDateString()}</p></div>
          </div>
          <div><span className="font-medium text-muted-foreground">Description</span><p className="mt-1 text-muted-foreground">{sub.description}</p></div>
          {sub.githubUrl && (
            <div>
              <span className="font-medium text-muted-foreground">GitHub</span>
              <a href={sub.githubUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline mt-1">
                {sub.githubUrl} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
          {sub.additionalInfo && <div><span className="font-medium text-muted-foreground">Additional Info</span><p className="mt-1 text-muted-foreground">{sub.additionalInfo}</p></div>}
          <Separator />
          {submitter && (
            <div className="flex items-center gap-2">
              {submitter.image && (
                <Image
                  src={submitter.image}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-full object-cover"
                />
              )}
              <div>
                <p className="font-medium">{submitter.name}</p>
                <p className="text-xs text-muted-foreground">{submitter.email}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review notes */}
      <Card>
        <CardHeader><CardTitle className="text-base">Review Notes</CardTitle></CardHeader>
        <CardContent>
          <form action={async (fd: FormData) => { "use server"; await updateReviewNotes(id, fd.get("notes") as string); }}>
            <textarea
              name="notes"
              defaultValue={sub.reviewNotes ?? ""}
              className="w-full min-h-[100px] rounded-md border bg-background px-3 py-2 text-sm resize-y"
              placeholder="Add review notes…"
            />
            <Button type="submit" size="sm" className="mt-2">Save Notes</Button>
          </form>
        </CardContent>
      </Card>

      {/* Onboarding progress */}
      {["onboarding", "live", "approved"].includes(sub.status) && (
        <Card>
          <CardHeader><CardTitle className="text-base">Onboarding Progress</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {ONBOARDING_STEPS.map((step) => {
              const done = progress[step.key] === true;
              return (
                <div key={step.key} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    {done ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                    <span className={done ? "line-through text-muted-foreground" : ""}>{step.label}</span>
                  </div>
                  <form action={async () => { "use server"; await updateOnboardingStep(id, step.key, !done); }}>
                    <Button type="submit" variant="ghost" size="sm" className="h-7 text-xs">
                      {done ? "Undo" : "Mark done"}
                    </Button>
                  </form>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
