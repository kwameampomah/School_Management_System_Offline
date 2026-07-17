import React, { useState } from "react";
import { useListAcademicYears, useCreateAcademicYear, useUpdateAcademicYear, useDeleteAcademicYear } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListAcademicYearsQueryKey } from "@workspace/api-client-react";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";

export default function AcademicYearsPage() {
  const { data: years, isLoading } = useListAcademicYears();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<any>(null);
  const deleteYear = useDeleteAcademicYear();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (isLoading) return <div><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this academic year?")) return;
    deleteYear.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Deleted successfully" });
        queryClient.invalidateQueries({ queryKey: getListAcademicYearsQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Academic Years</h1>
        <Button onClick={() => setIsCreateOpen(true)} size="sm"><Plus className="w-4 h-4 mr-1 sm:mr-2" /><span className="hidden sm:inline">Add Year</span><span className="sm:hidden">Add</span></Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {years?.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No academic years found.</TableCell></TableRow>
              )}
              {years?.map(year => (
                <TableRow key={year.id}>
                  <TableCell className="font-medium">{year.yearLabel}</TableCell>
                  <TableCell>
                    {year.isCurrent ? <Badge variant="secondary">Current</Badge> : <Badge variant="outline">Past</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditingYear(year)}><Pencil className="w-4 h-4 text-muted-foreground" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(year.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <YearDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      <YearDialog open={!!editingYear} onOpenChange={(v) => !v && setEditingYear(null)} year={editingYear} />
    </div>
  );
}

function YearDialog({ open, onOpenChange, year }: { open: boolean, onOpenChange: (v: boolean) => void, year?: any }) {
  const [label, setLabel] = useState(year?.yearLabel || "");
  const [isCurrent, setIsCurrent] = useState(year?.isCurrent || false);
  const create = useCreateAcademicYear();
  const update = useUpdateAcademicYear();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  React.useEffect(() => {
    if (open) {
      setLabel(year?.yearLabel || "");
      setIsCurrent(year?.isCurrent || false);
    }
  }, [open, year]);

  const isEditing = !!year;

  const handleSave = () => {
    if (!label) return toast({ variant: "destructive", title: "Label is required" });
    const payload = { yearLabel: label, isCurrent };
    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: getListAcademicYearsQueryKey() });
      toast({ title: isEditing ? "Updated" : "Created" });
      onOpenChange(false);
    };
    if (isEditing) {
      update.mutate({ id: year.id, data: payload }, { onSuccess });
    } else {
      create.mutate({ data: payload }, { onSuccess });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Academic Year" : "New Academic Year"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Year Label (e.g. 2024/2025)</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isCurrent" checked={isCurrent} onChange={e => setIsCurrent(e.target.checked)} className="rounded border-input text-primary focus:ring-primary h-4 w-4" />
            <Label htmlFor="isCurrent">Set as Current Year</Label>
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
