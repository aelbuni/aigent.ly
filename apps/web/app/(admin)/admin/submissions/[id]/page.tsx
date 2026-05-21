import { getSubmissionById } from "@/lib/admin-queries";
import Image from "next/image";
import {
  approveAndOnboard,
  rejectSubmission,
  startReview,
  updateOnboardingStep,
  updateReviewNotes,
} from "@/features/admin-submissions/actions/submission-actions";
import { AdminStatusPill } from "@/components/nextadmin/admin-data-table";
import { AdminPageHeader } from "@/components/nextadmin/admin-page-header";
import { CheckCircle, Circle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

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
      <AdminPageHeader
        title={sub.proposedName}
        description={sub.proposedSlug}
        action={
          <div className="flex gap-2 flex-wrap items-center">
            <AdminStatusPill status={sub.status} />
            {sub.linkedStackId && (
              <Link
                href={`/admin/stacks/${sub.linkedStackId}`}
                className="inline-flex items-center gap-1 rounded-sm border border-stroke bg-white px-3 py-1.5 text-sm font-medium text-dark hover:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
              >
                View Stack <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        }
      />

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        {sub.status === "pending" && (
          <form action={startReview.bind(null, id)}>
            <button
              type="submit"
              className="rounded-sm border border-stroke bg-white px-4 py-2 text-sm font-medium text-dark hover:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            >
              Start Review
            </button>
          </form>
        )}
        {(sub.status === "pending" || sub.status === "under_review") && (
          <form action={approveAndOnboard.bind(null, id)}>
            <button
              type="submit"
              className="rounded-sm bg-[#3C50E0] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Approve &amp; Onboard
            </button>
          </form>
        )}
      </div>

      {/* Submission Details */}
      <div className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-dark dark:text-white">Submission Details</h3>
        </div>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-sm font-medium text-dark-6">Ecosystem</span>
              <p className="mt-0.5 text-dark dark:text-white">{sub.ecosystem ?? "—"}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-dark-6">Submitted</span>
              <p className="mt-0.5 text-dark dark:text-white">{new Date(sub.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          <div>
            <span className="text-sm font-medium text-dark-6">Description</span>
            <p className="mt-1 text-dark-6">{sub.description}</p>
          </div>
          {sub.githubUrl && (
            <div>
              <span className="text-sm font-medium text-dark-6">GitHub</span>
              <a
                href={sub.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 flex items-center gap-1 text-[#3C50E0] hover:underline"
              >
                {sub.githubUrl} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
          {sub.additionalInfo && (
            <div>
              <span className="text-sm font-medium text-dark-6">Additional Info</span>
              <p className="mt-1 text-dark-6">{sub.additionalInfo}</p>
            </div>
          )}
          <hr className="border-stroke dark:border-dark-3 my-4" />
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
                <p className="font-medium text-dark dark:text-white">{submitter.name}</p>
                <p className="text-xs text-dark-6">{submitter.email}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Review notes */}
      <div className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-dark dark:text-white">Review Notes</h3>
        </div>
        <form action={async (fd: FormData) => { "use server"; await updateReviewNotes(id, fd.get("notes") as string); }}>
          <textarea
            name="notes"
            defaultValue={sub.reviewNotes ?? ""}
            className="w-full min-h-[100px] rounded-md border border-stroke bg-white px-3 py-2 text-sm resize-y dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            placeholder="Add review notes…"
          />
          <button
            type="submit"
            className="mt-2 rounded-sm bg-[#3C50E0] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Save Notes
          </button>
        </form>
      </div>

      {/* Reject form — only shown while submission is actionable */}
      {(sub.status === "pending" || sub.status === "under_review") && (
        <div className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-dark dark:text-white">Reject Submission</h3>
          </div>
          <form
            action={async (formData: FormData) => {
              "use server";
              const reason = (formData.get("rejectionReason") as string) ?? "";
              await rejectSubmission(id, reason);
            }}
          >
            <label className="text-sm font-medium text-dark-6">
              Rejection reason (optional)
            </label>
            <textarea
              name="rejectionReason"
              className="mt-1 w-full rounded-md border border-stroke bg-white p-2 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white"
              rows={2}
              placeholder="Explain why this submission is rejected…"
            />
            <button
              type="submit"
              className="mt-2 rounded-sm bg-[#D34053] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Reject
            </button>
          </form>
        </div>
      )}

      {/* Onboarding progress */}
      {["onboarding", "live", "approved"].includes(sub.status) && (
        <div className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-dark dark:text-white">Onboarding Progress</h3>
          </div>
          <div className="space-y-2">
            {ONBOARDING_STEPS.map((step) => {
              const done = progress[step.key] === true;
              return (
                <div key={step.key} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    {done ? (
                      <CheckCircle className="h-4 w-4 text-[#219653]" />
                    ) : (
                      <Circle className="h-4 w-4 text-dark-6" />
                    )}
                    <span className={done ? "line-through text-dark-6" : "text-dark dark:text-white"}>
                      {step.label}
                    </span>
                  </div>
                  <form action={async () => { "use server"; await updateOnboardingStep(id, step.key, !done); }}>
                    <button
                      type="submit"
                      className="h-7 rounded-sm border border-stroke bg-white px-2.5 text-xs font-medium text-dark hover:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                    >
                      {done ? "Undo" : "Mark done"}
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
