import { useState } from "react";
import { Link } from "wouter";
import { 
  useListTerms, 
  useListClasses, 
  useListReportCardStatuses, 
  useUpdateReportCardStatus, 
  useInitReportCardStatus,
  useGetScoreCompletion,
  useGetMe
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListReportCardStatusesQueryKey } from "@workspace/api-client-react";
import { Loader2, FileText, CheckCircle, Send, PlayCircle, Eye } from "lucide-react";

export default function ReportCardsPage() {
  const { data: user } = useGetMe();
  const [termFilter, setTermFilter] = useState<string>("");
  
  const { data: terms } = useListTerms();
  const currentTermId = terms?.find(t => t.isCurrent)?.id.toString() || "";
  if (!termFilter && currentTermId) setTermFilter(currentTermId);

  const { data: classes, isLoading: classesLoading } = useListClasses();
  const { data: statuses, isLoading: statusLoading } = useListReportCardStatuses(
    termFilter ? { termId: parseInt(termFilter) } : undefined,
    { query: { enabled: !!termFilter, queryKey: ['listReportCardStatuses', { termFilter }] } }
  );
  
  const { data: completions, isLoading: compLoading } = useGetScoreCompletion(
    { termId: parseInt(termFilter) },
    { query: { enabled: !!termFilter, queryKey: ['getScoreCompletion', { termFilter }] } }
  );

  const filteredClasses = classes?.filter(cls => {
    if (user?.role === "admin") return true;
    if (user?.role === "teacher") return cls.classTeacherId === user.teacherId;
    return false;
  });

  const updateStatus = useUpdateReportCardStatus();
  const initStatus = useInitReportCardStatus();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleAdvanceStatus = (classId: number, currentStatusStr?: string) => {
    const termId = parseInt(termFilter);
    const existing = statuses?.find(s => s.classId === classId);
    
    let nextStatus: "draft" | "submitted" | "approved" | "published" = "draft";
    if (!existing) nextStatus = "draft";
    else if (existing.status === "draft") nextStatus = "submitted";
    else if (existing.status === "submitted") nextStatus = "approved";
    else if (existing.status === "approved") nextStatus = "published";
    else return;

    if (!confirm(`Are you sure you want to change status to ${nextStatus}?`)) return;

    const onSuccess = () => {
      toast({ title: `Status updated to ${nextStatus}` });
      queryClient.invalidateQueries({ queryKey: getListReportCardStatusesQueryKey() });
    };

    if (!existing) {
      initStatus.mutate({ termId, classId }, { onSuccess });
    } else {
      updateStatus.mutate({ id: existing.id, data: { status: nextStatus } }, { onSuccess });
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return <Badge variant="outline">Not Started</Badge>;
    if (status === "draft") return <Badge variant="secondary">Draft</Badge>;
    if (status === "submitted") return <Badge variant="default" className="bg-blue-600">Submitted</Badge>;
    if (status === "approved") return <Badge variant="default" className="bg-purple-600">Approved</Badge>;
    if (status === "published") return <Badge variant="default" className="bg-green-600">Published</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  const isLoading = classesLoading || statusLoading || compLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Report Card Publishing Workflow</h1>
        <p className="text-muted-foreground text-sm">Monitor score entry progress and publish report cards per class.</p>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="space-y-1 w-full sm:max-w-xs">
            <Select value={termFilter} onChange={e => setTermFilter(e.target.value)} className="w-full">
              <option value="">Select Term</option>
              {terms?.map(t => <option key={t.id} value={t.id}>{t.name} ({t.academicYearLabel})</option>)}
            </Select>
          </div>
        </CardContent>
      </Card>

      {!termFilter ? (
        <div className="text-center p-8 border rounded-lg border-dashed text-muted-foreground">Select a term to view workflow.</div>
      ) : isLoading ? (
        <div><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : (
        <Card className="overflow-x-auto">
          <Table className="min-w-full sm:min-w-[560px]">
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead className="hidden sm:table-cell">Score Entry Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClasses?.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No classes found.</TableCell></TableRow>
              )}
              {filteredClasses?.map(cls => {
                const statusObj = statuses?.find(s => s.classId === cls.id);
                // Aggregated progress for the class
                const classComps = completions?.filter(c => c.classId === cls.id) || [];
                const totalExpected = classComps.reduce((acc, c) => acc + c.totalExpected, 0);
                const totalEntered = classComps.reduce((acc, c) => acc + c.totalEntered, 0);
                const percent = totalExpected > 0 ? Math.round((totalEntered / totalExpected) * 100) : 0;

                return (
                  <TableRow key={cls.id}>
                    <TableCell className="font-medium">
                      {cls.name}
                      {/* Show progress inline on mobile */}
                      <div className="sm:hidden mt-1 flex items-center gap-2">
                        <div className="w-20 bg-muted rounded-full h-1.5">
                          <div className="bg-primary h-1.5 rounded-full" style={{ width: `${percent}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{percent}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-full max-w-[150px] bg-muted rounded-full h-2">
                          <div className="bg-primary h-2 rounded-full" style={{ width: `${percent}%` }} />
                        </div>
                        <span className="text-sm font-medium">{percent}%</span>
                        <span className="text-xs text-muted-foreground">({totalEntered}/{totalExpected})</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(statusObj?.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {statusObj?.status !== "published" && (() => {
                          const label = !statusObj ? "Init Draft" : statusObj.status === "draft" ? "Submit for Approval" : statusObj.status === "submitted" ? "Approve" : "Publish";
                          const shortLabel = !statusObj ? "Init Draft" : statusObj.status === "draft" ? "Submit" : statusObj.status === "submitted" ? "Approve" : "Publish";
                          return (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleAdvanceStatus(cls.id, statusObj?.status)}
                              disabled={!statusObj && percent < 100}
                              aria-label={label}
                            >
                              {!statusObj || statusObj.status === "draft" ? <Send className="w-4 h-4 sm:mr-2" /> : <CheckCircle className="w-4 h-4 sm:mr-2" />}
                              <span className="hidden sm:inline">{shortLabel}</span>
                            </Button>
                          );
                        })()}
                        <Link href={user?.role === "teacher" ? `/teacher/report-cards/${cls.id}/${termFilter}` : `/admin/report-cards/${cls.id}/${termFilter}`} className="inline-flex">
                          <Button variant="secondary" size="sm" aria-label="View Reports">
                            <Eye className="w-4 h-4 sm:mr-2" />
                            <span className="hidden sm:inline">View Reports</span>
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
