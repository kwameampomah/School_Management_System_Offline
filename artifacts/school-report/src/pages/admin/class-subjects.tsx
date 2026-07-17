import { useState } from "react";
import { useRoute } from "wouter";
import { useGetClass, useListClassSubjects, useListSubjects, useAddClassSubject, useRemoveClassSubject } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListClassSubjectsQueryKey } from "@workspace/api-client-react";
import { Loader2, Plus, Trash2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function ClassSubjectsPage() {
  const [, params] = useRoute("/admin/classes/:classId/subjects");
  const classId = parseInt(params?.classId || "0");
  
  const { data: cls, isLoading: clsLoading } = useGetClass(classId, { query: { enabled: !!classId, queryKey: ['class', classId] }});
  const { data: classSubjects, isLoading: subjectsLoading } = useListClassSubjects(classId, { query: { enabled: !!classId, queryKey: getListClassSubjectsQueryKey(classId) }});
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const removeSubject = useRemoveClassSubject();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (clsLoading || subjectsLoading) return <div><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!cls) return <div>Class not found</div>;

  const handleRemove = (classSubjectId: number) => {
    if (!confirm("Remove this subject from the class? Any associated scores will be lost.")) return;
    removeSubject.mutate({ id: classSubjectId }, {
      onSuccess: () => {
        toast({ title: "Removed successfully" });
        queryClient.invalidateQueries({ queryKey: getListClassSubjectsQueryKey(classId) });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2">
          <Link href="/admin/classes" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Classes
          </Link>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Subjects for {cls.name}</h1>
            <p className="text-muted-foreground text-sm hidden sm:block">Assign curriculum subjects to this class.</p>
          </div>
          <Button onClick={() => setIsAddOpen(true)} size="sm" className="shrink-0"><Plus className="w-4 h-4 mr-1 sm:mr-2" /><span className="hidden sm:inline">Add Subject</span><span className="sm:hidden">Add</span></Button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table className="min-w-[320px]">
            <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Subject Name</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classSubjects?.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No subjects assigned yet.</TableCell></TableRow>
            )}
            {classSubjects?.map(cs => (
              <TableRow key={cs.id}>
                <TableCell className="font-mono text-xs">{cs.subjectCode}</TableCell>
                <TableCell className="font-medium">{cs.subjectName}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleRemove(cs.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          </Table>
        </div>
      </Card>

      <AddSubjectDialog classId={classId} open={isAddOpen} onOpenChange={setIsAddOpen} existingSubjects={classSubjects?.map(cs => cs.subjectId) || []} />
    </div>
  );
}

function AddSubjectDialog({ classId, open, onOpenChange, existingSubjects }: { classId: number, open: boolean, onOpenChange: (v: boolean) => void, existingSubjects: number[] }) {
  const [subjectId, setSubjectId] = useState("");
  const { data: allSubjects } = useListSubjects();
  const addSubject = useAddClassSubject();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleAdd = () => {
    if (!subjectId) return toast({ variant: "destructive", title: "Select a subject" });
    
    addSubject.mutate({ id: classId, data: { subjectId: parseInt(subjectId) } }, {
      onSuccess: () => {
        toast({ title: "Subject assigned to class" });
        queryClient.invalidateQueries({ queryKey: getListClassSubjectsQueryKey(classId) });
        onOpenChange(false);
        setSubjectId("");
      }
    });
  };

  const availableSubjects = allSubjects?.filter(s => !existingSubjects.includes(s.id)) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle>Assign Subject</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Subject</Label>
            <Select value={subjectId} onChange={e => setSubjectId(e.target.value)}>
              <option value="">Select subject...</option>
              {availableSubjects.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </Select>
            {availableSubjects.length === 0 && <p className="text-sm text-muted-foreground mt-2">All available subjects have been assigned to this class.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAdd} disabled={!subjectId || addSubject.isPending}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
