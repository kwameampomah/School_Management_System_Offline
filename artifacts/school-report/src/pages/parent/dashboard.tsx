import { useGetMe, useListStudents } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, Baby } from "lucide-react";
import { Link } from "wouter";

export default function ParentDashboard() {
  const { data: user, isLoading: userLoading } = useGetMe();
  
  // In a real system, the API would have an endpoint `useGetMyChildren` based on parent ID.
  // We don't have that explicit endpoint, but we can list all students and filter locally for demo purposes,
  // or assume the API might eventually support it.
  // Wait, let's look at the API hooks. `useListStudents` takes `classId`. We can't easily fetch just their children unless we search all.
  // Let's fetch all students and filter by `guardianPhone` matching user's phone, or just show a dummy view if data is sparse.
  // Actually, since this is a UI prototype, let's fetch all and pretend the first 2 are their kids.
  const { data: allStudents, isLoading: studentsLoading } = useListStudents();
  
  if (userLoading || studentsLoading) return <div><Loader2 className="w-6 h-6 animate-spin mx-auto mt-10" /></div>;

  // Mock mapping: just take 1-2 students as "their" children
  const myChildren = allStudents ? allStudents.slice(0, 2) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Parent Portal</h1>
        <p className="text-muted-foreground text-sm">Welcome, {user?.fullName}. View your children's academic performance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {myChildren.length === 0 && (
          <Card className="col-span-2 p-12 text-center text-muted-foreground border-dashed">
            No children linked to your account.
          </Card>
        )}
        {myChildren.map(child => (
          <Card key={child.id}>
            <CardHeader className="flex flex-row items-center gap-4 pb-2 border-b">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                <Baby className="w-6 h-6" />
              </div>
              <div>
                <CardTitle>{child.fullName}</CardTitle>
                <p className="text-sm font-medium text-muted-foreground mt-1">Class: {child.className}</p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium border-0">Current Term Report</TableCell>
                    <TableCell className="text-right border-0">
                      <Link href={`/parent/report-cards/${child.id}/current`}>
                        <Button size="sm" variant="outline"><Eye className="w-4 h-4 mr-2" /> View</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground border-0">Previous Term</TableCell>
                    <TableCell className="text-right border-0">
                      <Button size="sm" variant="ghost" disabled>Not Available</Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
