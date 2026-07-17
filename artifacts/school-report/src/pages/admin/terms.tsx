import { useState, useEffect } from "react";
import { useListTerms, useCreateTerm, useUpdateTerm, useDeleteTerm, useListAcademicYears } from "@workspace/api-client-react";
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
import { getListTermsQueryKey } from "@workspace/api-client-react";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function TermsPage() {
  const { data: terms, isLoading } = useListTerms();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<any>(null);
  const deleteTerm = useDeleteTerm();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (isLoading) return <div><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this term?")) return;
    deleteTerm.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Deleted successfully" });
        queryClient.invalidateQueries({ queryKey: getListTermsQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Terms</h1>
        <Button onClick={() => setIsCreateOpen(true)} size="sm"><Plus className="w-4 h-4 mr-1 sm:mr-2" /><span className="hidden sm:inline">Add Term</span><span className="sm:hidden">Add</span></Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table className="min-w-[540px]">
            <TableHeader>
              <TableRow>
                <TableHead>Term Name</TableHead>
                <TableHead>Academic Year</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {terms?.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No terms found.</TableCell></TableRow>
              )}
              {terms?.map(term => (
                <TableRow key={term.id}>
                  <TableCell className="font-medium">{term.name}</TableCell>
                  <TableCell>{term.academicYearLabel}</TableCell>
                  <TableCell className="text-sm">{formatDate(term.startDate)}</TableCell>
                  <TableCell className="text-sm">{formatDate(term.endDate)}</TableCell>
                  <TableCell>
                    {term.isCurrent ? <Badge variant="secondary">Current</Badge> : <Badge variant="outline">Past</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditingTerm(term)}><Pencil className="w-4 h-4 text-muted-foreground" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(term.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <TermDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      <TermDialog open={!!editingTerm} onOpenChange={(v) => !v && setEditingTerm(null)} term={editingTerm} />
    </div>
  );
}

function TermDialog({ open, onOpenChange, term }: { open: boolean, onOpenChange: (v: boolean) => void, term?: any }) {
  const [name, setName] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);

  const { data: years } = useListAcademicYears();
  const create = useCreateTerm();
  const update = useUpdateTerm();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setName(term?.name || "");
      setAcademicYearId(term?.academicYearId?.toString() || (years?.find(y => y.isCurrent)?.id.toString() || ""));
      setStartDate(term?.startDate?.split("T")[0] || "");
      setEndDate(term?.endDate?.split("T")[0] || "");
      setIsCurrent(term?.isCurrent || false);
    }
  }, [open, term, years]);

  const handleSave = () => {
    if (!name || !academicYearId) return toast({ variant: "destructive", title: "Name and Academic Year required" });
    const payload = { name, academicYearId: parseInt(academicYearId), startDate: startDate || undefined, endDate: endDate || undefined, isCurrent };
    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: getListTermsQueryKey() });
      toast({ title: term ? "Updated" : "Created" });
      onOpenChange(false);
    };
    if (term) {
      update.mutate({ id: term.id, data: payload }, { onSuccess });
    } else {
      create.mutate({ data: payload }, { onSuccess });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle>{term ? "Edit Term" : "New Term"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Term Name (e.g. Term 1)</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Academic Year</Label>
            <Select value={academicYearId} onChange={e => setAcademicYearId(e.target.value)}>
              <option value="">Select Year...</option>
              {years?.map(y => <option key={y.id} value={y.id}>{y.yearLabel}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <input type="checkbox" id="isCurrentTerm" checked={isCurrent} onChange={e => setIsCurrent(e.target.checked)} className="rounded border-input text-primary focus:ring-primary h-4 w-4" />
            <Label htmlFor="isCurrentTerm">Set as Current Term</Label>
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
