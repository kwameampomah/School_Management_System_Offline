import React, { useState } from "react";
import {
  useListTeacherAssignments,
  useCreateTeacherAssignment,
  useDeleteTeacherAssignment,
  useListTeachers,
  useListTerms,
  useListClasses,
  useListClassSubjects
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListTeacherAssignmentsQueryKey } from "@workspace/api-client-react";
import { Loader2, Plus, Trash2 } from "lucide-react";

export default function TeacherAssignmentsPage() {
  const [termFilter, setTermFilter] = useState<string>("");
  const { data: assignments, isLoading } = useListTeacherAssignments(termFilter ? { termId: parseInt(termFilter) } : undefined);
  const { data: terms } = useListTerms();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const deleteAssignment = useDeleteTeacherAssignment();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const currentTermId = terms?.find(t => t.isCurrent)?.id.toString() || "";
  if (!termFilter && currentTermId) setTermFilter(currentTermId);

  if (isLoading) return <div><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const handleDelete = (id: number) => {
    if (!confirm("Remove this assignment?")) return;
    deleteAssignment.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Assignment removed" });
        queryClient.invalidateQueries({ queryKey: getListTeacherAssignmentsQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Teacher Assignments</h1>
          <p className="text-muted-foreground text-sm hidden sm:block">Assign teachers to specific subjects for a class in a given term.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={termFilter} onChange={e => setTermFilter(e.target.value)} className="flex-1 sm:w-44 sm:flex-none">
            <option value="">All Terms</option>
            {terms?.map(t => <option key={t.id} value={t.id}>{t.name} ({t.academicYearLabel})</option>)}
          </Select>
          <Button onClick={() => setIsCreateOpen(true)} size="sm" className="shrink-0"><Plus className="w-4 h-4 mr-1 sm:mr-2" /><span className="hidden sm:inline">Assign Teacher</span><span className="sm:hidden">Add</span></Button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table className="min-w-[480px]">
            <TableHeader>
              <TableRow>
                <TableHead>Teacher</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="hidden sm:table-cell">Term</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments?.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No assignments found.</TableCell></TableRow>
              )}
              {assignments?.map(assignment => (
                <TableRow key={assignment.id}>
                  <TableCell className="font-medium">{assignment.teacherName}</TableCell>
                  <TableCell className="text-sm">{assignment.className}</TableCell>
                  <TableCell className="text-sm">{assignment.subjectName}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{assignment.termName}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(assignment.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <AssignmentDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}

function AssignmentDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (v: boolean) => void }) {
  const [teacherId, setTeacherId] = useState("");
  const [termId, setTermId] = useState("");
  const [classId, setClassId] = useState("");
  const [classSubjectId, setClassSubjectId] = useState("");

  const { data: teachers } = useListTeachers();
  const { data: terms } = useListTerms();
  const { data: classes } = useListClasses();
  const { data: classSubjects } = useListClassSubjects(parseInt(classId), {
    query: { enabled: !!classId, queryKey: ['class-subjects', classId] }
  });

  const create = useCreateTeacherAssignment();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  React.useEffect(() => {
    if (open && terms) {
      setTeacherId("");
      setClassId("");
      setClassSubjectId("");
      setTermId(terms.find(t => t.isCurrent)?.id.toString() || "");
    }
  }, [open, terms]);

  const handleSave = () => {
    if (!teacherId || !termId || !classSubjectId) {
      return toast({ variant: "destructive", title: "Fill all required fields" });
    }
    create.mutate({
      data: { teacherId: parseInt(teacherId), termId: parseInt(termId), classSubjectId: parseInt(classSubjectId) }
    }, {
      onSuccess: () => {
        toast({ title: "Teacher assigned" });
        queryClient.invalidateQueries({ queryKey: getListTeacherAssignmentsQueryKey() });
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle>Assign Teacher to Subject</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Teacher</Label>
            <Select value={teacherId} onChange={e => setTeacherId(e.target.value)}>
              <option value="">Select teacher...</option>
              {teachers?.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Term</Label>
            <Select value={termId} onChange={e => setTermId(e.target.value)}>
              <option value="">Select term...</option>
              {terms?.map(t => <option key={t.id} value={t.id}>{t.name} ({t.academicYearLabel})</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Class</Label>
            <Select value={classId} onChange={e => { setClassId(e.target.value); setClassSubjectId(""); }}>
              <option value="">Select class...</option>
              {classes?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Select value={classSubjectId} onChange={e => setClassSubjectId(e.target.value)} disabled={!classId}>
              <option value="">Select subject...</option>
              {classSubjects?.map(cs => <option key={cs.id} value={cs.id}>{cs.subjectName}</option>)}
            </Select>
            {!classId && <p className="text-xs text-muted-foreground mt-1">Select a class first.</p>}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={create.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
