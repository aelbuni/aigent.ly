import { db, stack } from "@/lib/db";
import { updateStack, deleteStack } from "@/features/admin-stacks/actions/stack-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export default async function StackDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stackId = Number(id);

  const stackRows = await db.select().from(stack).where(eq(stack.id, stackId)).limit(1);

  const s = stackRows[0];
  if (!s) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{s.name}</h1>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant={s.catalogStatus === "launch" ? "default" : "secondary"}>{s.catalogStatus}</Badge>
          <span className="text-sm text-muted-foreground">{s.slug}</span>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Edit Stack</CardTitle></CardHeader>
        <CardContent>
          <form action={updateStack.bind(null, stackId)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" defaultValue={s.name} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" name="slug" defaultValue={s.slug} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ecosystem">Ecosystem</Label>
                <Input id="ecosystem" name="ecosystem" defaultValue={s.ecosystem ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label>Catalog Status</Label>
                <Select name="catalogStatus" defaultValue={s.catalogStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coming_soon">Coming Soon</SelectItem>
                    <SelectItem value="launch">Launch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="securityGrade">Security Grade</Label>
                <Input id="securityGrade" name="securityGrade" defaultValue={s.securityGrade ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input id="sortOrder" name="sortOrder" type="number" defaultValue={s.sortOrder} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
          <form action={deleteStack.bind(null, stackId)} className="mt-2">
            <Button type="submit" variant="destructive" size="sm">Delete Stack</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
