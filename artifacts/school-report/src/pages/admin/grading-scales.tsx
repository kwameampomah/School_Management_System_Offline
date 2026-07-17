import React, { useState } from "react";
import { useListGradingScales, useCreateGradingScale, useUpdateGradingScale, useDeleteGradingScale } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListGradingScalesQueryKey } from "@workspace/api-client-react";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";

export default function GradingScalesPage() {
  const { data: scales, isLoading } = useListGradingScales();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingScale, setEditingScale] = useState<any>(null);
  const deleteScale = useDeleteGradingScale();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (isLoading) return <div><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const sortedScales = scales ? [...scales].sort((a, b) => b.minScore - a.minScore) : [];

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this grading rule?")) return;
    deleteScale.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Deleted successfully" });
        queryClient.invalidateQueries({ queryKey: getListGradingScalesQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Grading Scale</h1>
          <p className="text-muted-foreground text-sm hidden sm:block">System-wide rules for mapping percentage scores to grades and remarks.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} size="sm"><Plus className="w-4 h-4 mr-1 sm:mr-2" /><span className="hidden sm:inline">Add Rule</span><span className="sm:hidden">Add</span></Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Score Range</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Remark</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedScales.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No grading rules found.</TableCell></TableRow>
              )}
              {sortedScales.map(scale => (
                <TableRow key={scale.id}>
                  <TableCell className="font-mono text-sm">{scale.minScore}% – {scale.maxScore}%</TableCell>
                  <TableCell className="font-bold text-primary">{scale.gradeLabel}</TableCell>
                  <TableCell>{scale.remark}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditingScale(scale)}><Pencil className="w-4 h-4 text-muted-foreground" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(scale.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <ScaleDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      <ScaleDialog open={!!editingScale} onOpenChange={(v) => !v && setEditingScale(null)} scale={editingScale} />
    </div>
  );
}

function ScaleDialog({ open, onOpenChange, scale }: { open: boolean, onOpenChange: (v: boolean) => void, scale?: any }) {
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [gradeLabel, setGradeLabel] = useState("");
  const [remark, setRemark] = useState("");

  const create = useCreateGradingScale();
  const update = useUpdateGradingScale();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  React.useEffect(() => {
    if (open) {
      setMinScore(scale?.minScore?.toString() || "");
      setMaxScore(scale?.maxScore?.toString() || "");
      setGradeLabel(scale?.gradeLabel || "");
      setRemark(scale?.remark || "");
    }
  }, [open, scale]);

  const handleSave = () => {
    if (!minScore || !maxScore || !gradeLabel || !remark) {
      return toast({ variant: "destructive", title: "Fill all fields" });
    }
    const payload = { minScore: parseInt(minScore), maxScore: parseInt(maxScore), gradeLabel, remark };
    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: getListGradingScalesQueryKey() });
      toast({ title: scale ? "Updated" : "Created" });
      onOpenChange(false);
    };
    if (scale) {
      update.mutate({ id: scale.id, data: payload }, { onSuccess });
    } else {
      create.mutate({ data: payload }, { onSuccess });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle>{scale ? "Edit Grading Rule" : "New Grading Rule"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Minimum Score (%)</Label>
              <Input type="number" value={minScore} onChange={e => setMinScore(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Maximum Score (%)</Label>
              <Input type="number" value={maxScore} onChange={e => setMaxScore(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Grade Label (e.g. A1, B2)</Label>
            <Input value={gradeLabel} onChange={e => setGradeLabel(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Remark (e.g. Excellent, Good, Pass)</Label>
            <Input value={remark} onChange={e => setRemark(e.target.value)} />
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
