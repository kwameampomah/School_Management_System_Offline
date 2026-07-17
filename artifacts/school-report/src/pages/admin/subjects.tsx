import React, { useState } from "react";
import { useListSubjects, useCreateSubject, useUpdateSubject, useDeleteSubject } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListSubjectsQueryKey } from "@workspace/api-client-react";
import { Loader2, Plus, Pencil, Trash2, BookOpen } from "lucide-react";

export default function SubjectsPage() {
  const { data: subjects, isLoading } = useListSubjects();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any>(null);
  const deleteSubject = useDeleteSubject();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (isLoading) return <div><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this subject?")) return;
    deleteSubject.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Deleted successfully" });
        queryClient.invalidateQueries({ queryKey: getListSubjectsQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Master Subjects</h1>
          <p className="text-muted-foreground text-sm hidden sm:block">Define global subjects before assigning them to classes.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} size="sm"><Plus className="w-4 h-4 mr-1 sm:mr-2" /><span className="hidden sm:inline">Add Subject</span><span className="sm:hidden">Add</span></Button>
      </div>

      {/* Desktop Layout: Table */}
      <Card className="hidden sm:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Subject Name</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects?.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No subjects found.</TableCell></TableRow>
              )}
              {subjects?.map(subject => (
                <TableRow key={subject.id}>
                  <TableCell className="font-medium font-mono text-xs">{subject.code}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                      {subject.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditingSubject(subject)}><Pencil className="w-4 h-4 text-muted-foreground" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(subject.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
        {subjects?.length === 0 && (
          <div className="text-center text-muted-foreground py-10 border border-dashed rounded-xl bg-card/20">
            No subjects found.
          </div>
        )}
        {subjects?.map(subject => (
          <div key={subject.id} className="border border-border/50 bg-card/30 px-3 py-2.5 rounded-lg flex items-center justify-between gap-3 shadow-sm">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <h3 className="font-semibold text-sm text-foreground truncate">{subject.name}</h3>
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                <span className="font-mono text-[10px]">{subject.code}</span>
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-8 h-8 rounded-full" 
                onClick={() => setEditingSubject(subject)}
              >
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-8 h-8 rounded-full text-destructive hover:bg-destructive/5 hover:text-destructive" 
                onClick={() => handleDelete(subject.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <SubjectDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      <SubjectDialog open={!!editingSubject} onOpenChange={(v) => !v && setEditingSubject(null)} subject={editingSubject} />
    </div>
  );
}

function SubjectDialog({ open, onOpenChange, subject }: { open: boolean, onOpenChange: (v: boolean) => void, subject?: any }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const create = useCreateSubject();
  const update = useUpdateSubject();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  React.useEffect(() => {
    if (open) {
      setName(subject?.name || "");
      setCode(subject?.code || "");
    }
  }, [open, subject]);

  const handleSave = () => {
    if (!name || !code) return toast({ variant: "destructive", title: "Name and Code are required" });
    const payload = { name, code };
    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: getListSubjectsQueryKey() });
      toast({ title: subject ? "Updated" : "Created" });
      onOpenChange(false);
    };
    if (subject) {
      update.mutate({ id: subject.id, data: payload }, { onSuccess });
    } else {
      create.mutate({ data: payload }, { onSuccess });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle>{subject ? "Edit Subject" : "New Subject"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Subject Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mathematics" />
          </div>
          <div className="space-y-2">
            <Label>Subject Code</Label>
            <Input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. MATH-01" className="font-mono text-sm uppercase" />
            <p className="text-xs text-muted-foreground">A unique short code for reports.</p>
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
