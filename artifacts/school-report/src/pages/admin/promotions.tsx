import React, { useState } from "react";
import { useListClasses, useListStudents } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListStudentsQueryKey } from "@workspace/api-client-react";
import { Loader2, ArrowRightLeft, ShieldAlert } from "lucide-react";

export default function PromotionsPage() {
  const [sourceClass, setSourceClass] = useState<string>("");
  const [targetClass, setTargetClass] = useState<string>("");
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [isPromoting, setIsPromoting] = useState(false);

  const { data: classes, isLoading: classesLoading } = useListClasses();
  
  // Fetch students for the selected source class
  const { data: students, isLoading: studentsLoading } = useListStudents(
    sourceClass ? { classId: parseInt(sourceClass) } : undefined,
    { query: { enabled: !!sourceClass, queryKey: ["students-for-promotion", sourceClass] } }
  );

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSelectAll = (checked: boolean) => {
    if (checked && students) {
      setSelectedStudents(students.map(s => s.id));
    } else {
      setSelectedStudents([]);
    }
  };

  const handleSelectStudent = (studentId: number, checked: boolean) => {
    if (checked) {
      setSelectedStudents(prev => [...prev, studentId]);
    } else {
      setSelectedStudents(prev => prev.filter(id => id !== studentId));
    }
  };

  const handlePromote = async () => {
    if (selectedStudents.length === 0) {
      return toast({ variant: "destructive", title: "Select students first" });
    }
    if (!targetClass) {
      return toast({ variant: "destructive", title: "Select a target class" });
    }
    if (sourceClass === targetClass) {
      return toast({ variant: "destructive", title: "Source and Target class must be different" });
    }

    if (!confirm(`Are you sure you want to promote ${selectedStudents.length} students to the new class?`)) {
      return;
    }

    setIsPromoting(true);
    try {
      const response = await fetch("/api/promotions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: selectedStudents,
          targetClassId: parseInt(targetClass),
        }),
      });

      if (!response.ok) throw new Error(await response.text());

      toast({
        title: "Promotion completed",
        description: `Successfully promoted ${selectedStudents.length} students.`,
      });

      // Clear selections and reload lists
      setSelectedStudents([]);
      queryClient.invalidateQueries({ queryKey: ["students-for-promotion", sourceClass] });
      queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Promotion failed", description: e.message });
    } finally {
      setIsPromoting(false);
    }
  };

  const isLoading = classesLoading;

  if (isLoading) return <div><Loader2 className="w-6 h-6 animate-spin mx-auto mt-10" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Bulk Class Promotions</h1>
        <p className="text-muted-foreground text-sm">Promote cohorts of students from one class to another at the end of the academic year.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Settings Card */}
        <Card className="md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Promotion Setup</CardTitle>
            <CardDescription>Select source and target classes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Source Class (Current)</label>
              <Select value={sourceClass} onChange={e => { setSourceClass(e.target.value); setSelectedStudents([]); }}>
                <option value="">Select source class...</option>
                {classes?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>

            <div className="flex justify-center py-1">
              <ArrowRightLeft className="w-5 h-5 text-muted-foreground rotate-90 md:rotate-0" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Target Class (Promotion destination)</label>
              <Select value={targetClass} onChange={e => setTargetClass(e.target.value)}>
                <option value="">Select target class...</option>
                {classes?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>

            <Button onClick={handlePromote} disabled={isPromoting || !sourceClass || !targetClass} className="w-full mt-4">
              {isPromoting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Promote Selected Students
            </Button>
          </CardContent>
        </Card>

        {/* Student List */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Student Roster</CardTitle>
            <CardDescription>Select the students to promote.</CardDescription>
          </CardHeader>
          <CardContent>
            {!sourceClass ? (
              <div className="text-center p-8 border rounded-lg border-dashed text-muted-foreground">
                Select a source class to load students.
              </div>
            ) : studentsLoading ? (
              <div className="py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
            ) : students?.length === 0 ? (
              <div className="text-center p-8 border rounded-lg border-dashed text-muted-foreground">
                No students enrolled in this class.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[420px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={students ? selectedStudents.length === students.length : false}
                          onChange={e => handleSelectAll(e.target.checked)}
                          className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                        />
                      </TableHead>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Gender</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students?.map(student => (
                      <TableRow key={student.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedStudents.includes(student.id)}
                            onChange={e => handleSelectStudent(student.id, e.target.checked)}
                            className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{student.studentIdNumber}</TableCell>
                        <TableCell className="font-medium">{student.fullName}</TableCell>
                        <TableCell className="capitalize text-sm">{student.gender || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="mt-4 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Warning: Promoting students will update their permanent class records. Make sure the target class is correct.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
