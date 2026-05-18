import { auth } from "@/auth";
import { db, layer } from "@/lib/db";
import { redirect } from "next/navigation";
import { ADMIN_BYPASS } from "@/lib/admin-bypass";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function createLayerAction(formData: FormData) {
  "use server";
  if (!ADMIN_BYPASS) {
    const session = await auth();
    if (session?.user?.role !== "admin") redirect("/");
  }

  const [created] = await db.insert(layer).values({
    slug: formData.get("slug") as string,
    name: formData.get("name") as string,
    description: formData.get("description") as string,
    concernStatement: formData.get("concernStatement") as string,
    iconName: (formData.get("iconName") as string) || null,
    colorToken: (formData.get("colorToken") as string) || null,
    isSystem: false,
    isActive: formData.get("isActive") === "on",
    sortOrder: Number(formData.get("sortOrder") ?? 200),
  }).returning({ id: layer.id });

  redirect(`/admin/layers/${created.id}`);
}

export default function NewLayerPage() {
  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Layer</h1>
        <p className="text-muted-foreground">Create a custom protection layer category.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Layer Details</CardTitle></CardHeader>
        <CardContent>
          <form action={createLayerAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slug">Slug *</Label>
                <Input id="slug" name="slug" required placeholder="e.g. my_custom_layer" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description *</Label>
              <textarea id="description" name="description" className="w-full min-h-[70px] rounded-md border bg-background px-3 py-2 text-sm resize-y" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="concernStatement">Concern Statement *</Label>
              <textarea id="concernStatement" name="concernStatement" className="w-full min-h-[70px] rounded-md border bg-background px-3 py-2 text-sm resize-y" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="iconName">Icon Name</Label>
                <Input id="iconName" name="iconName" placeholder="e.g. lock" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input id="sortOrder" name="sortOrder" type="number" defaultValue="200" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                name="isActive"
                id="isActive"
                defaultChecked={true}
                className="h-4 w-4 rounded border-stroke"
              />
              <label htmlFor="isActive" className="text-dark-6 text-sm font-medium">
                Active (visible in guardrail generation)
              </label>
            </div>
            <Button type="submit">Create Layer</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
