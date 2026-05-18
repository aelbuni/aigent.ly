import { getThreatById, listLayers } from "@/lib/admin-queries";
import { updateThreat, assignThreatLayers, assignThreatStacks } from "@/features/admin-threats/actions/threat-actions";
import { db, stack } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";

const SEVERITY_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  critical: "destructive", high: "destructive", medium: "default", low: "secondary", info: "outline",
};
const OWASP_REFS = ["A01","A02","A03","A04","A05","A06","A07","A08","A09","A10","LLM01","LLM02","LLM03","LLM04","LLM05","LLM06","LLM07","LLM08","LLM09","LLM10"];

export default async function ThreatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Guard: "new" is handled by threats/new/page.tsx — shouldn't reach here
  if (id === "new") {
    redirect("/admin/threats/new");
  }
  const threatId = decodeURIComponent(id);
  const [data, layers, allStacks] = await Promise.all([
    getThreatById(threatId),
    listLayers(),
    db.select({ id: stack.id, name: stack.name, slug: stack.slug }).from(stack).orderBy(stack.sortOrder),
  ]);
  if (!data) notFound();

  const { threat: t, layers: threatLayers, stacks: threatStacks } = data;
  const assignedLayerIds = new Set(threatLayers.map((l) => l.layerId));
  const assignedStackMap = new Map(threatStacks.map((s) => [s.stackId, s.severity]));

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <div className="flex items-center gap-2">
          {t.isActivelyExploited && <AlertTriangle className="h-5 w-5 text-destructive" />}
          <h1 className="text-xl font-bold tracking-tight break-all">{t.name}</h1>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{t.publicId}</code>
          {t.severity && <Badge variant={SEVERITY_VARIANTS[t.severity] ?? "outline"}>{t.severity}</Badge>}
          <Badge variant="outline">{t.source}</Badge>
          <Badge variant="secondary">{t.family}</Badge>
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="layers">Layers ({threatLayers.length})</TabsTrigger>
          <TabsTrigger value="stacks">Stacks ({threatStacks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardContent className="pt-4">
              <form action={updateThreat.bind(null, threatId)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" name="name" defaultValue={t.name} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Severity</Label>
                    <Select name="severity" defaultValue={t.severity ?? ""}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["critical","high","medium","low","info"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Family</Label>
                    <Select name="family" defaultValue={t.family}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owasp_web">OWASP Web</SelectItem>
                        <SelectItem value="owasp_llm">OWASP LLM</SelectItem>
                        <SelectItem value="mitre_atlas">MITRE ATLAS</SelectItem>
                        <SelectItem value="vibe_coding">Vibe Coding</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <textarea name="description" defaultValue={t.description ?? ""} className="w-full min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm resize-y" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="aiAmplification">AI Amplification</Label>
                    <textarea name="aiAmplification" defaultValue={t.aiAmplification != null ? JSON.stringify(t.aiAmplification, null, 2) : ""} className="w-full min-h-[60px] rounded-md border bg-background px-3 py-2 text-sm resize-y" />
                  </div>
                  <input type="hidden" name="source" value={t.source} />
                  <input type="hidden" name="publicId" value={t.publicId} />
                  <div className="flex items-center gap-2">
                    <Checkbox id="isActivelyExploited" name="isActivelyExploited" defaultChecked={t.isActivelyExploited} />
                    <Label htmlFor="isActivelyExploited">Actively Exploited</Label>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>OWASP Refs</Label>
                  <div className="flex flex-wrap gap-3">
                    {OWASP_REFS.map((ref) => (
                      <div key={ref} className="flex items-center gap-1.5">
                        <Checkbox id={`owasp-${ref}`} name="owaspRefs" value={ref} defaultChecked={(t.owaspRefs ?? []).includes(ref)} />
                        <Label htmlFor={`owasp-${ref}`} className="text-xs cursor-pointer">{ref}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <Button type="submit">Save Changes</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="layers">
          <Card>
            <CardHeader><CardTitle className="text-base">Layer Assignment</CardTitle></CardHeader>
            <CardContent>
              <form
                action={async (fd: FormData) => {
                  "use server";
                  const ids = fd.getAll("layerIds") as string[];
                  await assignThreatLayers(threatId, ids.map((id) => ({ layerId: id, relevance: "primary" as const })));
                }}
                className="space-y-3"
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  {layers.map((l) => (
                    <div key={l.id} className="flex items-center gap-2">
                      <Checkbox id={`layer-${l.id}`} name="layerIds" value={l.id} defaultChecked={assignedLayerIds.has(l.id)} />
                      <Label htmlFor={`layer-${l.id}`} className="cursor-pointer text-sm">{l.name}</Label>
                    </div>
                  ))}
                </div>
                <Button type="submit" size="sm">Save Layers</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stacks">
          <Card>
            <CardHeader><CardTitle className="text-base">Stack Assignment</CardTitle></CardHeader>
            <CardContent>
              <form
                action={async (fd: FormData) => {
                  "use server";
                  const stackIds = fd.getAll("stackIds").map(Number);
                  const entries = stackIds.map((stackId) => ({
                    stackId,
                    severity: (fd.get(`severity_${stackId}`) ?? "medium") as "critical" | "high" | "medium" | "low" | "info",
                  }));
                  await assignThreatStacks(threatId, entries);
                }}
                className="space-y-3"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {allStacks.map((s) => {
                    const checked = assignedStackMap.has(s.id);
                    const currentSeverity = assignedStackMap.get(s.id) ?? "medium";
                    return (
                      <div key={s.id} className="flex items-center gap-3 rounded border p-2">
                        <Checkbox id={`stack-${s.id}`} name="stackIds" value={String(s.id)} defaultChecked={checked} />
                        <Label htmlFor={`stack-${s.id}`} className="flex-1 cursor-pointer text-sm">{s.name}</Label>
                        <Select name={`severity_${s.id}`} defaultValue={currentSeverity}>
                          <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["critical","high","medium","low","info"].map((sev) => (
                              <SelectItem key={sev} value={sev} className="text-xs">{sev}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
                <Button type="submit" size="sm">Save Stacks</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
