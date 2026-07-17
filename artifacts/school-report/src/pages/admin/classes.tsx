import { useState, useEffect } from "react";
import { useListClasses, useCreateClass, useUpdateClass, useDeleteClass, useListAcademicYears, useListTeachers } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListClassesQueryKey } from "@workspace/api-client-react";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";

export default function ClassesPage() {
  const { data: classes, isLoading } = useListClasses();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);
  const deleteClass = useDeleteClass();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (isLoading) return <div><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this class?")) return;
    deleteClass.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Deleted successfully" });
        queryClient.invalidateQueries({ queryKey: getListClassesQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Classes</h1>
        <Button onClick={() => setIsCreateOpen(true)} size="sm"><Plus className="w-4 h-4 mr-1 sm:mr-2" /><span className="hidden sm:inline">Add Class</span><span className="sm:hidden">Add</span></Button>
      </div>

      {/* Desktop Layout: Table */}
      <Card className="hidden sm:block">
        <div className="overflow-x-auto">
          <Table className="min-w-[480px]">
            <TableHeader>
              <TableRow>
                <TableHead>Class Name</TableHead>
                <TableHead>Academic Year</TableHead>
                <TableHead className="hidden sm:table-cell">Class Teacher</TableHead>
                <TableHead>Students</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes?.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No classes found.</TableCell></TableRow>
              )}
              {classes?.map(cls => (
                <TableRow key={cls.id}>
                  <TableCell className="font-medium">{cls.name}</TableCell>
                  <TableCell className="text-sm">{cls.academicYearLabel}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{cls.classTeacherName || <span className="text-muted-foreground italic">Unassigned</span>}</TableCell>
                  <TableCell>{cls.studentCount || 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditingClass(cls)}><Pencil className="w-4 h-4 text-muted-foreground" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(cls.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Mobile Layout: Compact Card Grid */}
      <div className="grid grid-cols-1 gap-2.5 sm:hidden">
        {classes?.length === 0 && (
          <div className="text-center text-muted-foreground py-10 border border-dashed rounded-xl bg-card/20">
            No classes found.
          </div>
        )}
        {classes?.map(cls => (
          <div key={cls.id} className="border border-border/50 bg-card/30 px-3 py-2.5 rounded-lg flex items-center justify-between gap-3 shadow-sm">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-foreground truncate">{cls.name}</h3>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 leading-none shrink-0">{cls.academicYearLabel}</Badge>
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                <span className="truncate">Teacher: {cls.classTeacherName || "Unassigned"}</span>
                <span>•</span>
                <span>Students: {cls.studentCount || 0}</span>
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-8 h-8 rounded-full" 
                onClick={() => setEditingClass(cls)}
              >
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-8 h-8 rounded-full text-destructive hover:bg-destructive/5 hover:text-destructive" 
                onClick={() => handleDelete(cls.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <ClassDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      <ClassDialog open={!!editingClass} onOpenChange={(v) => !v && setEditingClass(null)} cls={editingClass} />
    </div>
  );
}

function ClassDialog({ open, onOpenChange, cls }: { open: boolean, onOpenChange: (v: boolean) => void, cls?: any }) {
  const [name, setName] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [classTeacherId, setClassTeacherId] = useState("");

  const { data: years } = useListAcademicYears();
  const { data: teachers } = useListTeachers();
  const create = useCreateClass();
  const update = useUpdateClass();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setName(cls?.name || "");
      setAcademicYearId(cls?.academicYearId?.toString() || (years?.find(y => y.isCurrent)?.id.toString() || ""));
      setClassTeacherId(cls?.classTeacherId?.toString() || "");
    }
  }, [open, cls, years]);

  const handleSave = () => {
    if (!name || !academicYearId) return toast({ variant: "destructive", title: "Name and Academic Year required" });
    const payload = { name, academicYearId: parseInt(academicYearId), classTeacherId: classTeacherId ? parseInt(classTeacherId) : undefined };
    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: getListClassesQueryKey() });
      toast({ title: cls ? "Updated" : "Created" });
      onOpenChange(false);
    };
    if (cls) {
      update.mutate({ id: cls.id, data: payload }, { onSuccess });
    } else {
      create.mutate({ data: payload as any }, { onSuccess });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle>{cls ? "Edit Class" : "New Class"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Class Name (e.g. Basic 1A)</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Academic Year</Label>
            <Select value={academicYearId} onChange={e => setAcademicYearId(e.target.value)} disabled={!!cls}>
              <option value="">Select Year...</option>
              {years?.map(y => <option key={y.id} value={y.id}>{y.yearLabel}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Class Teacher (Optional)</Label>
            <Select value={classTeacherId} onChange={e => setClassTeacherId(e.target.value)}>
              <option value="">Unassigned</option>
              {teachers?.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={create.isPending || update.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
