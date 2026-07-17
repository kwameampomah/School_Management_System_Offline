import React, { useState } from "react";
import {
  useListAssessmentComponents,
  useCreateAssessmentComponent,
  useUpdateAssessmentComponent,
  useDeleteAssessmentComponent,
  useListTerms,
  useListClasses,
  useListClassSubjects
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListAssessmentComponentsQueryKey } from "@workspace/api-client-react";
import { Loader2, Plus, Pencil, Trash2, Info } from "lucide-react";

export default function AssessmentComponentsPage() {
  const [termFilter, setTermFilter] = useState<string>("");
  const [classFilter, setClassFilter] = useState<string>("");
  const [classSubjectFilter, setClassSubjectFilter] = useState<string>("");

  const { data: terms } = useListTerms();
  const { data: classes } = useListClasses();
  const { data: classSubjects } = useListClassSubjects(parseInt(classFilter), {
    query: { enabled: !!classFilter, queryKey: ['class-subjects', classFilter] }
  });

  const currentTermId = terms?.find(t => t.isCurrent)?.id.toString() || "";
  if (!termFilter && currentTermId) setTermFilter(currentTermId);

  const { data: components, isLoading } = useListAssessmentComponents(
    { termId: termFilter ? parseInt(termFilter) : undefined, classSubjectId: classSubjectFilter ? parseInt(classSubjectFilter) : undefined },
    { query: { enabled: !!termFilter && !!classSubjectFilter, queryKey: ['listAssessmentComponents', { termFilter, classSubjectFilter }] } }
  );

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<any>(null);
  const deleteComponent = useDeleteAssessmentComponent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure? This will delete all student scores for this component.")) return;
    deleteComponent.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Deleted successfully" });
        queryClient.invalidateQueries({ queryKey: getListAssessmentComponentsQueryKey() });
      }
    });
  };

  const totalWeight = components?.reduce((sum, c) => sum + c.weightPercent, 0) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Assessment Configuration</h1>
        <p className="text-muted-foreground text-sm hidden sm:block">Define how scores are calculated for a subject. Weights must add up to 100%.</p>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Term</Label>
            <Select value={termFilter} onChange={e => setTermFilter(e.target.value)} className="w-full">
              <option value="">Select Term</option>
              {terms?.map(t => <option key={t.id} value={t.id}>{t.name} ({t.academicYearLabel})</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Class</Label>
            <Select value={classFilter} onChange={e => { setClassFilter(e.target.value); setClassSubjectFilter(""); }} className="w-full">
              <option value="">Select Class</option>
              {classes?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Select value={classSubjectFilter} onChange={e => setClassSubjectFilter(e.target.value)} disabled={!classFilter} className="w-full">
              <option value="">Select Subject</option>
              {classSubjects?.map(cs => <option key={cs.id} value={cs.id}>{cs.subjectName}</option>)}
            </Select>
          </div>
        </CardContent>
      </Card>

      {!termFilter || !classSubjectFilter ? (
        <div className="text-center p-8 border rounded-lg border-dashed text-muted-foreground">
          <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a Term, Class, and Subject to view and manage assessments.</p>
        </div>
      ) : isLoading ? (
        <div><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : (
        <Card>
          <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/10">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="font-semibold">Assessment Components</h3>
              <div className={`text-sm px-2 py-1 rounded border ${totalWeight === 100 ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}`}>
                Total: {totalWeight}%
              </div>
            </div>
            <Button onClick={() => setIsCreateOpen(true)} size="sm"><Plus className="w-4 h-4 mr-2" /> Add Component</Button>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[380px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Component Name</TableHead>
                  <TableHead>Max Score</TableHead>
                  <TableHead>Weight (%)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {components?.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No components defined.</TableCell></TableRow>
                )}
                {components?.map(comp => (
                  <TableRow key={comp.id}>
                    <TableCell className="font-medium">{comp.name}</TableCell>
                    <TableCell>{comp.maxScore}</TableCell>
                    <TableCell className="font-semibold">{comp.weightPercent}%</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditingComponent(comp)}><Pencil className="w-4 h-4 text-muted-foreground" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(comp.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <ComponentDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} termId={parseInt(termFilter)} classSubjectId={parseInt(classSubjectFilter)} />
      <ComponentDialog open={!!editingComponent} onOpenChange={(v) => !v && setEditingComponent(null)} component={editingComponent} termId={parseInt(termFilter)} classSubjectId={parseInt(classSubjectFilter)} />
    </div>
  );
}

function ComponentDialog({ open, onOpenChange, component, termId, classSubjectId }: { open: boolean, onOpenChange: (v: boolean) => void, component?: any, termId: number, classSubjectId: number }) {
  const [name, setName] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [weightPercent, setWeightPercent] = useState("");

  const create = useCreateAssessmentComponent();
  const update = useUpdateAssessmentComponent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  React.useEffect(() => {
    if (open) {
      setName(component?.name || "");
      setMaxScore(component?.maxScore?.toString() || "");
      setWeightPercent(component?.weightPercent?.toString() || "");
    }
  }, [open, component]);

  const handleSave = () => {
    if (!name || !maxScore || !weightPercent) return toast({ variant: "destructive", title: "Fill all required fields" });
    const payload = { name, maxScore: parseInt(maxScore), weightPercent: parseInt(weightPercent), termId, classSubjectId };
    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: getListAssessmentComponentsQueryKey() });
      toast({ title: component ? "Updated" : "Created" });
      onOpenChange(false);
    };
    if (component) {
      update.mutate({ id: component.id, data: payload }, { onSuccess });
    } else {
      create.mutate({ data: payload }, { onSuccess });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle>{component ? "Edit Component" : "Add Component"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Component Name (e.g. Class Exercise, Mid-Term Exam)</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Max Raw Score</Label>
              <Input type="number" value={maxScore} onChange={e => setMaxScore(e.target.value)} />
              <p className="text-xs text-muted-foreground">e.g. 40 for a test marked out of 40.</p>
            </div>
            <div className="space-y-2">
              <Label>Weight (%)</Label>
              <Input type="number" value={weightPercent} onChange={e => setWeightPercent(e.target.value)} />
              <p className="text-xs text-muted-foreground">Contribution to final grade (e.g. 30).</p>
            </div>
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
