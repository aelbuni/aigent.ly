import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import Link from "next/link";

export default async function SubmitStackSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-xl px-6 py-12 text-center">
      <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
      <h1 className="text-2xl font-bold tracking-tight">Submission Received</h1>
      <p className="mt-2 text-muted-foreground">
        Thanks for your proposal! Our team will review it within a few days.
      </p>
      {params.id && (
        <p className="mt-2 text-xs text-muted-foreground">
          Reference ID: <code className="bg-muted px-1 rounded">{params.id}</code>
        </p>
      )}
      <div className="flex justify-center gap-3 mt-6">
        <Button asChild variant="outline"><Link href="/stacks">Browse Stacks</Link></Button>
        <Button asChild><Link href="/">Back to Home</Link></Button>
      </div>
    </div>
  );
}
