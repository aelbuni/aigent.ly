import { AdminPageHeader } from "@/components/nextadmin/admin-page-header";
import { getLLMConfig, AVAILABLE_MODELS } from "@/lib/admin-queries";
import { saveLLMConfig, saveTaskConfigs } from "@/features/admin-llm/actions/llm-actions";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { ConnectivityTest } from "@/features/admin-llm/components/connectivity-test";

function CredentialPill({ label, detected }: { label: string; detected: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {detected
        ? <CheckCircle className="size-4 shrink-0 text-emerald-500" />
        : <XCircle className="size-4 shrink-0 text-destructive" />}
      <code className="bg-gray-2 dark:bg-dark-2 rounded px-1.5 py-0.5 text-xs">{label}</code>
      <span className="text-dark-6 text-xs">{detected ? "detected" : "missing"}</span>
    </div>
  );
}

export default async function LLMConfigPage() {
  const { global: cfg, tasks } = await getLLMConfig();
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  const hasAwsRegion = !!process.env.AWS_REGION;
  const hasAwsKey = !!process.env.AWS_ACCESS_KEY_ID;
  const hasAwsSecret = !!process.env.AWS_SECRET_ACCESS_KEY;
  const hasAwsSession = !!process.env.AWS_SESSION_TOKEN;

  const credsMissingForProvider =
    cfg.provider === "bedrock" ? !hasAwsRegion || !hasAwsKey || !hasAwsSecret
    : !hasAnthropicKey;

  return (
    <div className="space-y-6 max-w-2xl">
      <AdminPageHeader
        title="LLM Configuration"
        description="Configure provider, model, and per-task overrides. Credentials stay in .env."
      />

      {credsMissingForProvider && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
          <AlertCircle className="size-5 mt-0.5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Credentials missing for the selected provider (<strong>{cfg.provider}</strong>). See the setup guide below.
          </p>
        </div>
      )}

      {/* ── Provider ── */}
      <section className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark space-y-4">
        <h2 className="text-dark font-semibold dark:text-white">Provider</h2>
        <form action={saveLLMConfig} className="space-y-4">
          <div className="flex flex-wrap gap-4">
            {(["anthropic", "bedrock"] as const).map((p) => (
              <label key={p} className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="provider"
                  value={p}
                  defaultChecked={cfg.provider === p}
                  className="accent-primary"
                />
                <span className="text-dark text-sm dark:text-white capitalize">
                  {p === "anthropic" ? "Anthropic API" : "AWS Bedrock"}
                </span>
              </label>
            ))}
          </div>
          {/* Pass other fields through as hidden so the full form is valid */}
          <input type="hidden" name="defaultModel" value={cfg.defaultModel} />
          <input type="hidden" name="summarizerEnabled" value={cfg.summarizerEnabled ? "on" : "off"} />
          <button type="submit" className="bg-primary hover:bg-primary/90 rounded px-4 py-2 text-sm font-medium text-white">
            Save provider
          </button>
        </form>

        {/* Credential status */}
        <div className="space-y-2 border-t border-stroke pt-4 dark:border-dark-3">
          <p className="text-dark-6 text-xs font-medium uppercase tracking-wide">Credentials (.env — read-only)</p>
          <CredentialPill label="ANTHROPIC_API_KEY" detected={hasAnthropicKey} />
          <CredentialPill label="AWS_REGION" detected={hasAwsRegion} />
          <CredentialPill label="AWS_ACCESS_KEY_ID" detected={hasAwsKey} />
          <CredentialPill label="AWS_SECRET_ACCESS_KEY" detected={hasAwsSecret} />
          <CredentialPill label="AWS_SESSION_TOKEN (SSO)" detected={hasAwsSession} />
        </div>
      </section>

      {/* ── Default model ── */}
      <section className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark space-y-4">
        <h2 className="text-dark font-semibold dark:text-white">Default model</h2>
        <p className="text-dark-6 text-sm">Used for any task that doesn&apos;t have a specific override.</p>
        <form action={saveLLMConfig} className="flex flex-wrap items-end gap-4">
          <input type="hidden" name="provider" value={cfg.provider} />
          <input type="hidden" name="summarizerEnabled" value={cfg.summarizerEnabled ? "on" : "off"} />
          <div className="flex flex-wrap gap-3">
            {AVAILABLE_MODELS.map((m) => (
              <label key={m} className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="defaultModel"
                  value={m}
                  defaultChecked={cfg.defaultModel === m}
                  className="accent-primary"
                />
                <code className="text-dark dark:text-white text-xs">{m}</code>
              </label>
            ))}
          </div>
          <button type="submit" className="bg-primary hover:bg-primary/90 rounded px-4 py-2 text-sm font-medium text-white">
            Save model
          </button>
        </form>
      </section>

      {/* ── Per-task overrides ── */}
      <section className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark space-y-4">
        <h2 className="text-dark font-semibold dark:text-white">Per-task model overrides</h2>
        <form action={saveTaskConfigs} className="space-y-3">
          {tasks.map((t) => (
            <div key={t.task} className="flex flex-wrap items-center gap-3 rounded border border-stroke p-3 dark:border-dark-3">
              <span className="text-dark min-w-[220px] text-sm dark:text-white">{t.label}</span>
              <select
                name={`model_${t.task}`}
                defaultValue={t.model}
                className="border-stroke bg-gray-2 text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white h-8 rounded border px-2 text-xs outline-none"
              >
                {AVAILABLE_MODELS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  name={`enabled_${t.task}`}
                  defaultChecked={t.enabled}
                  className="accent-primary"
                />
                <span className="text-dark-6 text-xs">enabled</span>
              </label>
            </div>
          ))}
          <button type="submit" className="bg-primary hover:bg-primary/90 rounded px-4 py-2 text-sm font-medium text-white">
            Save all task configs
          </button>
        </form>
      </section>

      {/* ── Summarizer toggle ── */}
      <section className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark space-y-4">
        <h2 className="text-dark font-semibold dark:text-white">Summarizer</h2>
        <form action={saveLLMConfig} className="flex items-center gap-4">
          <input type="hidden" name="provider" value={cfg.provider} />
          <input type="hidden" name="defaultModel" value={cfg.defaultModel} />
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name="summarizerEnabled"
              defaultChecked={cfg.summarizerEnabled}
              className="accent-primary"
            />
            <span className="text-dark text-sm dark:text-white">Enabled</span>
          </label>
          <button type="submit" className="bg-primary hover:bg-primary/90 rounded px-4 py-2 text-sm font-medium text-white">
            Save
          </button>
        </form>
      </section>

      {/* ── Connectivity ── */}
      <section className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark space-y-3">
        <h2 className="text-dark font-semibold dark:text-white">Connectivity test</h2>
        <ConnectivityTest />
      </section>

      {/* ── Setup guide ── */}
      <section className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark space-y-4">
        <h2 className="text-dark font-semibold dark:text-white">Setup guide</h2>
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-dark font-medium dark:text-white">AWS Bedrock (via SSO)</p>
            <pre className="bg-gray-2 dark:bg-dark-2 mt-2 overflow-x-auto rounded p-3 text-xs">{`aws sso login
eval $(aws configure export-credentials --format env)
# Restart the dev server so the new env vars are picked up`}</pre>
          </div>
          <div>
            <p className="text-dark font-medium dark:text-white">Anthropic API</p>
            <pre className="bg-gray-2 dark:bg-dark-2 mt-1 rounded p-3 text-xs">{`# apps/web/.env
ANTHROPIC_API_KEY=sk-ant-...`}</pre>
          </div>
        </div>
      </section>
    </div>
  );
}
