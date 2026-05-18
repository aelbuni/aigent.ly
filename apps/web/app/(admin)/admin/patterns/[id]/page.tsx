import { db, layer, policyTemplate, policyTemplateStack, stack } from "@/lib/db";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

async function updatePatternAction(id: number, formData: FormData) {
  "use server";
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/");
  await db.update(policyTemplate).set({
    name: formData.get("name") as string,
    description: formData.get("description") as string || null,
    layerId: formData.get("layerId") as string,
    bodyMarkdown: formData.get("bodyMarkdown") as string || null,
    sortOrder: Number(formData.get("sortOrder") ?? 0),
  }).where(eq(policyTemplate.id, id));
  revalidatePath("/admin/patterns");
  revalidatePath(`/admin/patterns/${id}`);
}

async function assignStacksAction(id: number, formData: FormData) {
  "use server";
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/");
  const stackIds = (formData.getAll("stackIds") as string[]).map(Number);
  await db.delete(policyTemplateStack).where(eq(policyTemplateStack.templateId, id));
  if (stackIds.length) await db.insert(policyTemplateStack).values(stackIds.map((stackId) => ({ templateId: id, stackId })));
  revalidatePath(`/admin/patterns/${id}`);
}

export default async function PatternDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const templateId = Number(id);

  const [rows, layers, allStacks, assignedStacks] = await Promise.all([
    db.select().from(policyTemplate).where(eq(policyTemplate.id, templateId)).limit(1),
    db.select({ id: layer.id, name: layer.name }).from(layer).orderBy(layer.sortOrder),
    db.select({ id: stack.id, name: stack.name }).from(stack).orderBy(stack.sortOrder),
    db.select({ stackId: policyTemplateStack.stackId }).from(policyTemplateStack).where(eq(policyTemplateStack.templateId, templateId)),
  ]);

  const p = rows[0];
  if (!p) notFound();
  const assignedStackIds = new Set(assignedStacks.map((s) => s.stackId));

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{p.name}</h1>
        <p className="text-muted-foreground text-sm mt-1">{p.slug}</p>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="body">Body</TabsTrigger>
          <TabsTrigger value="stacks">Stacks</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card><CardContent className="pt-4">
            <form action={updatePatternAction.bind(null, templateId)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" defaultValue={p.name} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <textarea id="description" name="description" defaultValue={p.description ?? ""} className="w-full min-h-[60px] rounded-md border bg-background px-3 py-2 text-sm resize-y" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Layer</Label>
                  <Select name="layerId" defaultValue={p.layerId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{layers.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sortOrder">Sort Order</Label>
                  <Input id="sortOrder" name="sortOrder" type="number" defaultValue={p.sortOrder} />
                </div>
              </div>
              <Button type="submit">Save</Button>
            </form>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="body">
          <Card><CardContent className="pt-4">
            <form action={updatePatternAction.bind(null, templateId)} className="space-y-4">
              <input type="hidden" name="name" value={p.name} />
              <input type="hidden" name="layerId" value={p.layerId} />
              <input type="hidden" name="sortOrder" value={p.sortOrder} />
              <div className="space-y-1.5">
                <Label htmlFor="bodyMarkdown">Body Markdown</Label>
                <textarea id="bodyMarkdown" name="bodyMarkdown" defaultValue={p.bodyMarkdown ?? ""} className="w-full min-h-[400px] rounded-md border bg-background px-3 py-2 text-sm font-mono resize-y" />
              </div>
              <Button type="submit">Save Body</Button>
            </form>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="stacks">
          <Card><CardHeader><CardTitle className="text-base">Assigned Stacks</CardTitle></CardHeader><CardContent>
            <form action={assignStacksAction.bind(null, templateId)} className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {allStacks.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <Checkbox id={`stack-${s.id}`} name="stackIds" value={String(s.id)} defaultChecked={assignedStackIds.has(s.id)} />
                    <Label htmlFor={`stack-${s.id}`} className="cursor-pointer text-sm">{s.name}</Label>
                  </div>
                ))}
              </div>
              <Button type="submit" size="sm">Save Stacks</Button>
            </form>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
