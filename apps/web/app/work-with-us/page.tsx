import Link from "next/link";

export default function WorkWithUsPage() {
  return (
    <div className="mx-auto max-w-3xl px-gutter py-16">
      <h1 className="text-3xl font-bold tracking-tight text-on-surface">Work with us</h1>
      <p className="mt-4 font-body-base text-on-surface-variant">
        We help teams roll out agentic development with clear guardrails: catalog design, rule authoring, threat
        mapping, and reviews so your internal AI workflows stay auditable.
      </p>
      <h2 className="font-h2 text-h2 mt-10 text-on-surface">What we can help with</h2>
      <ul className="mt-4 list-inside list-disc space-y-2 font-body-base text-on-surface-variant">
        <li>Defining stack-specific rule sets aligned to your risk profile</li>
        <li>Integrating the rules directory and Composer export into your SDLC</li>
        <li>Training engineers on secure vibe coding patterns and review checkpoints</li>
      </ul>
      <div className="mt-10 rounded-xl border border-outline-variant bg-surface-container-low p-6">
        <p className="font-mono-label text-primary">Contact</p>
        <p className="mt-2 font-body-base text-on-surface-variant">
          For consulting or enablement, reach out via your usual channel. A public contact form will replace this
          block when operations are wired.
        </p>
        <a
          href="mailto:hello@aigent.ly"
          className="mt-4 inline-flex rounded bg-primary px-5 py-2.5 font-semibold text-on-primary"
        >
          Email hello@aigent.ly
        </a>
      </div>
      <p className="mt-8 font-body-sm text-on-surface-variant">
        Prefer self-serve? Start with the{" "}
        <Link href="/learn" className="text-primary hover:underline">
          Learn
        </Link>{" "}
        page and the open-source catalog.
      </p>
    </div>
  );
}
