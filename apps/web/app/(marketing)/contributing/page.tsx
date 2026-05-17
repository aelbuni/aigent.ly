import Link from "next/link";

export default function ContributingPage() {
  return (
    <div className="relative mx-auto max-w-3xl px-gutter py-12">
      <div className="pointer-events-none fixed inset-0 dot-grid opacity-30" />
      <h1 className="relative text-3xl font-bold text-on-surface">Contributing CVE evidence</h1>
      <p className="relative mt-4 text-body-base text-on-surface-variant">
        To unlock a &quot;coming soon&quot; stack, we need enough real, verifiable CVE (or published GHSA) rows with
        source URLs, mapped to rules via <code className="font-mono text-on-surface">rule_threat_map</code>.
      </p>
      <ul className="relative mt-6 list-disc space-y-2 pl-6 text-body-base text-on-surface-variant">
        <li>Each threat must have a <code className="font-mono text-on-surface">sourceUrl</code> (NVD or advisory).</li>
        <li>No synthetic IDs (e.g. <code className="font-mono text-on-surface">FRAMEWORK-CWE-*</code>).</li>
        <li>Each published rule must link at least one shippable threat and use CVE-titled sections in the body.</li>
      </ul>
      <p className="relative mt-8">
        <Link href="/stacks" className="text-primary hover:underline">
          Back to stacks
        </Link>
      </p>
    </div>
  );
}
