import { auth } from "@/auth";
import { db, stackSubmission } from "@/lib/db";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

async function submitStackAction(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin");

  const name = formData.get("proposedName") as string;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const [created] = await db
    .insert(stackSubmission)
    .values({
      submittedBy: session.user.id,
      proposedName: name,
      proposedSlug: slug,
      ecosystem: (formData.get("ecosystem") as string) || null,
      description: formData.get("description") as string,
      githubUrl: (formData.get("githubUrl") as string) || null,
      additionalInfo: (formData.get("additionalInfo") as string) || null,
    })
    .returning({ id: stackSubmission.id });

  redirect(`/submit-stack/success?id=${created.id}`);
}

export default async function SubmitStackPage() {
  const session = await auth();

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Submit a Stack</h1>
        <p className="mt-2 text-muted-foreground">
          Know a framework that should have AI security guardrails? Submit it for review and we&apos;ll add it to the catalog.
        </p>
      </div>

      {!session ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">Sign in with GitHub to submit a stack.</p>
            <Button asChild>
              <Link href="/api/auth/signin">Sign in with GitHub</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stack Proposal</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={submitStackAction} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="proposedName">Stack Name *</Label>
                <Input id="proposedName" name="proposedName" required placeholder="e.g. SvelteKit" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ecosystem">Ecosystem / Language</Label>
                <Input id="ecosystem" name="ecosystem" placeholder="e.g. Node.js, Python, Rust…" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Why should this be added? *</Label>
                <textarea
                  id="description"
                  name="description"
                  required
                  className="w-full min-h-[100px] rounded-md border bg-background px-3 py-2 text-sm resize-y"
                  placeholder="Describe the framework, its popularity, and why security guardrails would benefit developers using it with AI coding tools."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="githubUrl">GitHub Repository URL</Label>
                <Input id="githubUrl" name="githubUrl" type="url" placeholder="https://github.com/…" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="additionalInfo">Additional Notes</Label>
                <textarea
                  id="additionalInfo"
                  name="additionalInfo"
                  className="w-full min-h-[60px] rounded-md border bg-background px-3 py-2 text-sm resize-y"
                  placeholder="Any other context, links, or details…"
                />
              </div>
              <Button type="submit" className="w-full">Submit Stack Proposal</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
