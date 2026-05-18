import { createThreat } from "@/features/admin-threats/actions/threat-actions";
import { listLayers } from "@/lib/admin-queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const OWASP_REFS = ["A01","A02","A03","A04","A05","A06","A07","A08","A09","A10","LLM01","LLM02","LLM03","LLM04","LLM05","LLM06","LLM07","LLM08","LLM09","LLM10"];

export default async function NewThreatPage() {
  const [layers] = await Promise.all([listLayers()]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add Threat</h1>
        <p className="text-muted-foreground">Manually add a CVE or internal threat to the database.</p>
      </div>

      <form action={createThreat} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Identity</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="publicId">Public ID *</Label>
              <Input id="publicId" name="publicId" required placeholder="CVE-2024-1234 or AIGENT-001" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cveId">CVE ID</Label>
              <Input id="cveId" name="cveId" placeholder="CVE-2024-1234" />
            </div>
            <div className="space-y-1.5">
              <Label>Source *</Label>
              <Select name="source" required defaultValue="aigently_internal">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["nvd","osv","ghsa","cisa_kev","aigently","mitre_atlas","aigently_internal"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Family *</Label>
              <Select name="family" required defaultValue="owasp_web">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owasp_web">OWASP Web</SelectItem>
                  <SelectItem value="owasp_llm">OWASP LLM</SelectItem>
                  <SelectItem value="mitre_atlas">MITRE ATLAS</SelectItem>
                  <SelectItem value="vibe_coding">Vibe Coding</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required placeholder="Short descriptive name" />
            </div>
            <div className="space-y-1.5">
              <Label>Severity</Label>
              <Select name="severity">
                <SelectTrigger><SelectValue placeholder="Select severity" /></SelectTrigger>
                <SelectContent>
                  {["critical","high","medium","low","info"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sourceUrl">Source URL</Label>
              <Input id="sourceUrl" name="sourceUrl" type="url" placeholder="https://…" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <textarea id="description" name="description" className="w-full min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm resize-y" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="aiAmplification">AI Amplification Narrative</Label>
              <textarea id="aiAmplification" name="aiAmplification" className="w-full min-h-[60px] rounded-md border bg-background px-3 py-2 text-sm resize-y" placeholder="How AI coding tools amplify this risk…" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="isActivelyExploited" name="isActivelyExploited" />
              <Label htmlFor="isActivelyExploited">Actively Exploited (CISA KEV)</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Attack Vector</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>OWASP Refs</Label>
              <div className="flex flex-wrap gap-3">
                {OWASP_REFS.map((ref) => (
                  <div key={ref} className="flex items-center gap-1.5">
                    <Checkbox id={`owasp-${ref}`} name="owaspRefs" value={ref} />
                    <Label htmlFor={`owasp-${ref}`} className="text-xs cursor-pointer">{ref}</Label>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Layer Assignment</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {layers.map((l) => (
                <div key={l.id} className="flex items-center gap-2">
                  <Checkbox id={`layer-${l.id}`} name="layerIds" value={l.id} />
                  <Label htmlFor={`layer-${l.id}`} className="cursor-pointer text-sm">{l.name}</Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full sm:w-auto">Create Threat</Button>
      </form>
    </div>
  );
}
