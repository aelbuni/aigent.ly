import { getRuleById } from "@/lib/admin-queries";
import { updateRule, assignRuleLayers, assignRuleStacks } from "@/features/admin-rules/actions/rule-actions";
import { listLayers } from "@/lib/admin-queries";
import { db, stack } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { notFound } from "next/navigation";

export default async function RuleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, layers, allStacks] = await Promise.all([
    getRuleById(id),
    listLayers(),
    db.select({ id: stack.id, name: stack.name, slug: stack.slug }).from(stack).orderBy(stack.sortOrder),
  ]);

  if (!data) notFound();
  const { rule: r, layers: ruleLayers, stacks: ruleStacks, suggestedLayers } = data;
  const ruleLayerIds = new Set(ruleLayers.map((l) => l.layerId));
  const ruleStackIds = new Set(ruleStacks.map((s) => s.stackId));
  const suggestedLayerIds = suggestedLayers.map((l) => l.layerId);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{r.name}</h1>
          {r.certified && <Badge variant="default">Certified</Badge>}
        </div>
        <p className="text-muted-foreground text-sm mt-1">{r.slug}</p>
      </div>

      <Tabs defaultValue="metadata">
        <TabsList>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="body">Body MDX</TabsTrigger>
          <TabsTrigger value="layers">Layers</TabsTrigger>
          <TabsTrigger value="stacks">Stacks</TabsTrigger>
        </TabsList>

        <TabsContent value="metadata">
          <Card>
            <CardContent className="pt-4">
              <form action={updateRule.bind(null, id)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" name="name" defaultValue={r.name} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="slug">Slug</Label>
                    <Input id="slug" name="slug" defaultValue={r.slug} required />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" name="description" defaultValue={r.description} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Rule Type</Label>
                    <Select name="ruleType" defaultValue={r.ruleType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pattern">Pattern</SelectItem>
                        <SelectItem value="deps">Dependencies</SelectItem>
                        <SelectItem value="config">Config</SelectItem>
                        <SelectItem value="runtime">Runtime</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Strength Score (auto-computed)</Label>
                    <p className="text-sm text-dark dark:text-white font-medium">{r.strengthScore} / 100</p>
                    <p className="text-xs text-dark-6">Computed from certification status, body length, and directive keywords.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="author">Author</Label>
                    <Input id="author" name="author" defaultValue={r.author} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="version">Version</Label>
                    <Input id="version" name="version" defaultValue={r.version} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dateAdded">Date Added</Label>
                    <Input id="dateAdded" name="dateAdded" type="date" defaultValue={r.dateAdded} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastUpdated">Last Updated</Label>
                    <Input id="lastUpdated" name="lastUpdated" type="date" defaultValue={r.lastUpdated} required />
                  </div>
                  <div className="flex items-center gap-2 pt-4">
                    <Checkbox id="certified" name="certified" defaultChecked={r.certified} />
                    <Label htmlFor="certified">Certified</Label>
                  </div>
                </div>
                <Button type="submit">Save Metadata</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="body">
          <Card>
            <CardHeader><CardTitle className="text-base">Body MDX</CardTitle></CardHeader>
            <CardContent>
              <form action={async (fd: FormData) => { "use server"; await updateRule(id, fd); }} className="space-y-4">
                <input type="hidden" name="name" value={r.name} />
                <input type="hidden" name="slug" value={r.slug} />
                <input type="hidden" name="description" value={r.description} />
                <input type="hidden" name="version" value={r.version} />
                <input type="hidden" name="dateAdded" value={r.dateAdded} />
                <input type="hidden" name="lastUpdated" value={r.lastUpdated} />
                <input type="hidden" name="author" value={r.author} />
                <input type="hidden" name="ruleType" value={r.ruleType} />
                <div className="space-y-1.5">
                  <Label htmlFor="bodyMdx">Body MDX</Label>
                  <textarea
                    id="bodyMdx"
                    name="bodyMdx"
                    defaultValue={r.bodyMdx ?? ""}
                    className="w-full min-h-[400px] rounded-md border bg-background px-3 py-2 text-sm font-mono resize-y"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="summaryMdx">Summary MDX</Label>
                  <textarea
                    id="summaryMdx"
                    name="summaryMdx"
                    defaultValue={r.summaryMdx ?? ""}
                    className="w-full min-h-[100px] rounded-md border bg-background px-3 py-2 text-sm font-mono resize-y"
                  />
                </div>
                <Button type="submit">Save Body</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="layers">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Assigned Layers</CardTitle>
                {suggestedLayerIds.length > 0 && (
                  <button
                    type="button"
                    onClick={undefined}
                    className="text-primary hover:text-primary/80 text-xs font-medium"
                    id="suggest-layers-btn"
                    data-suggest={JSON.stringify(suggestedLayerIds)}
                  >
                    Suggest from threats ({suggestedLayerIds.length})
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <form
                id="layers-form"
                action={async (fd: FormData) => {
                  "use server";
                  const ids = fd.getAll("layerIds") as string[];
                  await assignRuleLayers(id, ids);
                }}
                className="space-y-3"
              >
                <div className="space-y-2">
                  {layers.map((l) => (
                    <div key={l.id} className="flex items-center gap-2">
                      <Checkbox id={`layer-${l.id}`} name="layerIds" value={l.id} defaultChecked={ruleLayerIds.has(l.id)} />
                      <Label htmlFor={`layer-${l.id}`} className="cursor-pointer">{l.name}</Label>
                    </div>
                  ))}
                </div>
                <Button type="submit" size="sm">Save Layers</Button>
              </form>
              {/* Inline script: "Suggest from threats" pre-checks suggested layer checkboxes */}
              {suggestedLayerIds.length > 0 && (
                <script dangerouslySetInnerHTML={{ __html: `
                  (function() {
                    var btn = document.getElementById('suggest-layers-btn');
                    if (!btn) return;
                    var ids = JSON.parse(btn.getAttribute('data-suggest') || '[]');
                    btn.addEventListener('click', function() {
                      ids.forEach(function(id) {
                        var cb = document.querySelector('input[name="layerIds"][value="' + id + '"]');
                        if (cb) cb.checked = true;
                      });
                    });
                  })();
                `}} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stacks">
          <Card>
            <CardHeader><CardTitle className="text-base">Assigned Stacks</CardTitle></CardHeader>
            <CardContent>
              <form
                action={async (fd: FormData) => {
                  "use server";
                  const ids = (fd.getAll("stackIds") as string[]).map(Number);
                  await assignRuleStacks(id, ids);
                }}
                className="space-y-3"
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  {allStacks.map((s) => (
                    <div key={s.id} className="flex items-center gap-2">
                      <Checkbox id={`stack-${s.id}`} name="stackIds" value={String(s.id)} defaultChecked={ruleStackIds.has(s.id)} />
                      <Label htmlFor={`stack-${s.id}`} className="cursor-pointer">{s.name}</Label>
                    </div>
                  ))}
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
