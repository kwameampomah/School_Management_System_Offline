import { useRoute, Link } from "wouter";
import { useGetStudentReportCard, useGetStudent, useListTerms } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ArrowLeft, Printer, Download } from "lucide-react";
import StudentReportCardView from "@/components/StudentReportCardView";

export default function SingleReportCardPage() {
  const [, params] = useRoute("/parent/report-cards/:studentId/:termId");
  const studentId = parseInt(params?.studentId || "0");
  const termIdParam = params?.termId;

  const { data: terms } = useListTerms();
  const currentTermId = terms?.find(t => t.isCurrent)?.id;
  const termId = termIdParam === "current" ? currentTermId : parseInt(termIdParam || "0");

  const { data: student } = useGetStudent(studentId, { query: { enabled: !!studentId, queryKey: ['student', studentId] }});
  
  const { data: reportCard, isLoading, isError } = useGetStudentReportCard(studentId, termId || 0, {
    query: { enabled: !!studentId && !!termId, queryKey: ['student-report', studentId, termId] }
  });

  if (isLoading || !termId) return <div><Loader2 className="w-6 h-6 animate-spin mx-auto mt-10" /></div>;

  if (isError || !reportCard) {
    return (
      <div className="space-y-4">
        <div className="print:hidden">
          <Link href="/parent" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Link>
        </div>
        <Card className="p-12 text-center text-muted-foreground border-dashed">
          Report card for {student?.fullName} is not available or not yet published.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href="/parent" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Link>
        <div className="flex items-center gap-2">
          <Button onClick={() => window.print()} variant="outline" size="sm">
            <Printer className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Print</span>
          </Button>
          <a href={`/api/report-cards/${studentId}/${termId}/export`} download>
            <Button size="sm">
              <Download className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Download PDF</span>
            </Button>
          </a>
        </div>
      </div>

      <StudentReportCardView reportCard={reportCard} />
    </div>
  );
}
