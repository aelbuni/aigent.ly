import { createStack } from "@/features/admin-stacks/actions/stack-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function NewStackPage() {
  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Stack</h1>
        <p className="text-muted-foreground">Create a new stack in the catalog.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Stack Details</CardTitle></CardHeader>
        <CardContent>
          <form action={createStack} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" name="name" required placeholder="e.g. Next.js" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slug">Slug *</Label>
                <Input id="slug" name="slug" required placeholder="e.g. nextjs" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ecosystem">Ecosystem</Label>
                <Input id="ecosystem" name="ecosystem" placeholder="e.g. node" />
              </div>
              <div className="space-y-1.5">
                <Label>Catalog Status *</Label>
                <Select name="catalogStatus" defaultValue="coming_soon">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coming_soon">Coming Soon</SelectItem>
                    <SelectItem value="launch">Launch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input id="sortOrder" name="sortOrder" type="number" defaultValue="999" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="securityGrade">Security Grade</Label>
                <Input id="securityGrade" name="securityGrade" placeholder="e.g. B+" />
              </div>
            </div>
            <Button type="submit">Create Stack</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
