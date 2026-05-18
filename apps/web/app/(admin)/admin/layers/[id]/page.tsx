import { db, layer } from "@/lib/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ADMIN_BYPASS } from "@/lib/admin-bypass";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function updateLayerAction(id: string, formData: FormData) {
  "use server";
  if (!ADMIN_BYPASS) {
    const session = await auth();
    if (session?.user?.role !== "admin") redirect("/");
  }

  await db.update(layer).set({
    name: formData.get("name") as string,
    description: formData.get("description") as string,
    concernStatement: formData.get("concernStatement") as string,
    iconName: (formData.get("iconName") as string) || null,
    colorToken: (formData.get("colorToken") as string) || null,
    isActive: formData.get("isActive") === "on",
    sortOrder: Number(formData.get("sortOrder") ?? 100),
    updatedAt: new Date(),
  }).where(eq(layer.id, id));

  revalidatePath("/admin/layers");
  revalidatePath(`/admin/layers/${id}`);
}

export default async function LayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.select().from(layer).where(eq(layer.id, id)).limit(1);
  const l = rows[0];
  if (!l) notFound();

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{l.name}</h1>
          {l.isSystem && <Badge variant="outline">System</Badge>}
          {!l.isActive && <Badge variant="secondary">Inactive</Badge>}
        </div>
        <p className="text-muted-foreground text-sm mt-1">{l.slug}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Edit Layer</CardTitle></CardHeader>
        <CardContent>
          <form action={updateLayerAction.bind(null, id)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name {l.isSystem && <span className="text-muted-foreground text-xs">(system — editable)</span>}</Label>
              <Input id="name" name="name" defaultValue={l.name} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <textarea id="description" name="description" defaultValue={l.description} className="w-full min-h-[70px] rounded-md border bg-background px-3 py-2 text-sm resize-y" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="concernStatement">Concern Statement</Label>
              <textarea id="concernStatement" name="concernStatement" defaultValue={l.concernStatement} className="w-full min-h-[70px] rounded-md border bg-background px-3 py-2 text-sm resize-y" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="iconName">Icon Name (Material Symbol)</Label>
                <Input id="iconName" name="iconName" defaultValue={l.iconName ?? ""} placeholder="e.g. lock" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="colorToken">Color Token</Label>
                <Input id="colorToken" name="colorToken" defaultValue={l.colorToken ?? ""} placeholder="e.g. --layer-auth" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input id="sortOrder" name="sortOrder" type="number" defaultValue={l.sortOrder} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Checkbox id="isActive" name="isActive" defaultChecked={l.isActive} />
                <Label htmlFor="isActive">Active (visible to users)</Label>
              </div>
            </div>
            <Button type="submit">Save Changes</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
