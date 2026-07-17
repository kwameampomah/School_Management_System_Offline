import { StudentReportCard } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Award, Calendar, Bookmark, ShieldCheck } from "lucide-react";

function getGradeColor(grade: string | null | undefined): { bg: string; text: string; border: string } {
  if (!grade) return { bg: "bg-muted", text: "text-muted-foreground", border: "border-muted" };
  const g = grade.toUpperCase();
  if (g.startsWith("A") || g.startsWith("B")) {
    return { bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-500/20" };
  }
  if (g.startsWith("C")) {
    return { bg: "bg-teal-50 dark:bg-teal-500/10", text: "text-teal-700 dark:text-teal-400", border: "border-teal-200 dark:border-teal-500/20" };
  }
  if (g.startsWith("D") || g.startsWith("E")) {
    return { bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-500/20" };
  }
  return { bg: "bg-rose-50 dark:bg-rose-500/10", text: "text-rose-700 dark:text-rose-400", border: "border-rose-200 dark:border-rose-500/20" };
}

function getStatusBadge(status: string | null | undefined): { label: string; style: string } {
  const s = (status || "Draft").toUpperCase();
  if (s === "PUBLISHED") {
    return { label: "Published", style: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" };
  }
  if (s === "APPROVED") {
    return { label: "Approved", style: "bg-primary/15 text-primary dark:text-primary-foreground border-primary/20" };
  }
  if (s === "SUBMITTED") {
    return { label: "Submitted", style: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20" };
  }
  return { label: "Draft", style: "bg-muted text-muted-foreground border-border" };
}

export default function StudentReportCardView({ reportCard }: { reportCard: StudentReportCard }) {
  if (!reportCard) return null;

  const totalScore = reportCard.subjectResults?.reduce((acc, s) => acc + s.total, 0) || 0;
  const statusBadge = getStatusBadge(reportCard.reportCardStatus);

  return (
    <Card className="overflow-hidden border border-border/80 bg-card/60 backdrop-blur-md shadow-xl print:border-0 print:shadow-none print:m-0 print:p-0 print:bg-white">
      {/* Decorative top brand line */}
      <div className="h-2 bg-gradient-to-r from-purple-800 via-purple-500 to-red-500 print:hidden" />
      
      <div className="p-5 sm:p-10">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-center gap-5 border-b pb-6 mb-8 text-center sm:text-left print:border-b-2 print:border-black">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-2xl flex items-center justify-center shrink-0 shadow-md border border-border overflow-hidden print:border print:border-black">
            <img src="/logo.png" alt="Taifa Ebenezer Logo" className="w-16 h-16 sm:w-20 sm:h-20 object-contain" />
          </div>
          <div className="flex-1 space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-primary tracking-wider uppercase print:text-black">
              Taifa Ebenezer Prep. & J.H.S
            </h1>
            <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
              Terminal Report Card
            </h2>
            <div className="flex items-center justify-center sm:justify-start gap-3 mt-2 flex-wrap">
              <span className="inline-flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Calendar className="w-3.5 h-3.5 mr-1" /> {reportCard.academicYear}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 hidden sm:inline" />
              <span className="inline-flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Bookmark className="w-3.5 h-3.5 mr-1" /> {reportCard.termName}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 hidden sm:inline" />
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusBadge.style} print:hidden`}>
                {statusBadge.label}
              </span>
            </div>
          </div>
        </div>

        {/* Student Info Card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 bg-muted/20 p-5 sm:p-6 rounded-2xl border border-border/80 print:bg-white print:border print:border-black print:rounded-none">
          <InfoItem label="Student Name" value={reportCard.studentName?.toUpperCase()} highlight />
          <InfoItem label="Student ID" value={reportCard.studentIdNumber} />
          <InfoItem label="Class Allocated" value={reportCard.className} />
          <InfoItem label="Enrolled Term" value={reportCard.termName} />
        </div>

        {/* Subjects Table */}
        <div className="mb-8 rounded-2xl overflow-hidden border border-border/60 shadow-sm print:border-black print:rounded-none">
          <div className="overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow className="bg-emerald-950 hover:bg-emerald-950 print:bg-white print:border-b print:border-black">
                  <TableHead className="text-white font-bold h-11 border-r border-white/10 print:text-black print:border-r print:border-black">Subject & Assessment Breakdown</TableHead>
                  <TableHead className="text-white font-bold h-11 text-center w-20 border-r border-white/10 print:text-black print:border-r print:border-black">Class Avg</TableHead>
                  <TableHead className="text-white font-bold h-11 text-center w-20 border-r border-white/10 print:text-black print:border-r print:border-black">Highest</TableHead>
                  <TableHead className="text-white font-bold h-11 text-center w-20 border-r border-white/10 print:text-black print:border-r print:border-black">Lowest</TableHead>
                  <TableHead className="text-white font-bold h-11 text-center w-24 border-r border-white/10 print:text-black print:border-r print:border-black">Your Score</TableHead>
                  <TableHead className="text-white font-bold h-11 text-center w-20 border-r border-white/10 print:text-black print:border-r print:border-black">Position</TableHead>
                  <TableHead className="text-white font-bold h-11 text-center w-20 border-r border-white/10 print:text-black print:border-r print:border-black">Grade</TableHead>
                  <TableHead className="text-white font-bold h-11 pl-4 print:text-black">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportCard.subjectResults?.map((sub, i) => {
                  const gradeStyles = getGradeColor(sub.grade);
                  return (
                    <TableRow key={sub.subjectId} className={`${i % 2 === 0 ? "bg-muted/15" : "bg-background"} hover:bg-muted/30 transition-colors print:bg-white print:border-b print:border-black`}>
                      <TableCell className="font-bold text-foreground/90 border-r border-border/60 print:border-black py-3">
                        <div className="text-sm font-bold text-primary dark:text-emerald-400 print:text-black">{sub.subjectName}</div>
                        {sub.componentScores && sub.componentScores.length > 0 && (
                          <div className="mt-2 space-y-1 text-xs text-muted-foreground font-normal print:text-black print:font-light max-w-sm">
                            {sub.componentScores.map(c => (
                              <div key={c.componentId} className="flex justify-between border-b border-border/20 last:border-0 pb-0.5">
                                <span>{c.componentName} ({c.weightPercent}%):</span>
                                <span className="font-mono font-medium text-foreground print:text-black">{c.scoreValue}/{c.maxScore} (w: {c.weightedScore}%)</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono border-r border-border/60 text-muted-foreground text-sm print:border-black print:text-black">{sub.classAverage}</TableCell>
                      <TableCell className="text-center font-mono border-r border-border/60 text-muted-foreground text-sm print:border-black print:text-black">{sub.classHighest}</TableCell>
                      <TableCell className="text-center font-mono border-r border-border/60 text-muted-foreground text-sm print:border-black print:text-black">{sub.classLowest}</TableCell>
                      <TableCell className="text-center font-black font-mono border-r border-border/60 text-base print:border-black">{sub.total}</TableCell>
                      <TableCell className="text-center font-mono border-r border-border/60 text-sm print:border-black print:text-black">{sub.subjectRank}/{reportCard.totalStudents}</TableCell>
                      <TableCell className="text-center font-bold border-r border-border/60 print:border-black" style={{ padding: "6px" }}>
                        <span className={`inline-block px-3 py-0.5 rounded-md border text-sm font-black ${gradeStyles.bg} ${gradeStyles.text} ${gradeStyles.border} print:bg-white print:text-black print:border-none`}>
                          {sub.grade}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold text-sm pl-4 text-muted-foreground print:text-black">{sub.remark}</TableCell>
                    </TableRow>
                  );
                })}
                {(!reportCard.subjectResults || reportCard.subjectResults.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground italic">
                      No subject results available for this term.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Attendance, Conduct, & Remarks Section */}
        {reportCard.metadata && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 border-t border-b py-6 print:border-black print:border-t print:border-b">
            {/* Attendance & Behavioral Traits */}
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-primary uppercase tracking-wider border-b pb-2 flex items-center gap-2 print:border-black print:text-black">
                Attendance & Behavioral Traits
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-muted-foreground">Days Present:</span>
                  <span className="font-bold font-mono text-foreground print:text-black">
                    {reportCard.metadata.daysPresent} <span className="font-sans font-normal text-xs text-muted-foreground">of</span> {reportCard.metadata.daysOpened} <span className="font-sans font-normal text-xs text-muted-foreground">({reportCard.metadata.daysOpened > 0 ? Math.round((reportCard.metadata.daysPresent / reportCard.metadata.daysOpened) * 100) : 0}%)</span>
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm border-t border-border/40 pt-2 print:border-black">
                  <span className="font-semibold text-muted-foreground">General Conduct:</span>
                  <span className="font-bold capitalize">{reportCard.metadata.conduct || "—"}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-t border-border/40 pt-2 print:border-black">
                  <span className="font-semibold text-muted-foreground">Attitude to Work:</span>
                  <span className="font-bold capitalize">{reportCard.metadata.attitude || "—"}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-t border-border/40 pt-2 print:border-black">
                  <span className="font-semibold text-muted-foreground">Special Interest:</span>
                  <span className="font-bold capitalize">{reportCard.metadata.interest || "—"}</span>
                </div>
              </div>
            </div>

            {/* General Assessment Comments */}
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-primary uppercase tracking-wider border-b pb-2 flex items-center gap-2 print:border-black print:text-black">
                General Remarks & Comments
              </h3>
              <div className="space-y-4">
                <div className="text-sm">
                  <span className="font-bold text-muted-foreground block text-xs uppercase tracking-wider mb-1 print:text-black">Class Teacher's Remarks:</span>
                  <span className="italic text-foreground print:text-black">"{reportCard.metadata.teacherRemarks || "A hardworking and pleasant student."}"</span>
                </div>
                <div className="text-sm border-t border-border/40 pt-3 print:border-black">
                  <span className="font-bold text-muted-foreground block text-xs uppercase tracking-wider mb-1 print:text-black">Headmaster's Remarks:</span>
                  <span className="italic text-foreground print:text-black">"{reportCard.metadata.headmasterRemarks || "Satisfactory terminal results. Promoted."}"</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Summary Details & Signature Block */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Performance Summary Card */}
          <div className="bg-gradient-to-br from-muted/50 to-muted/20 p-6 rounded-2xl border border-border/80 flex flex-col justify-between print:bg-white print:border print:border-black print:rounded-none">
            <div>
              <h3 className="font-bold text-base flex items-center gap-2 border-b pb-3 mb-4 print:border-black print:text-black">
                <Award className="w-4 h-4 text-primary print:text-black" /> Overall Academic Performance
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-muted-foreground text-sm">Accumulated Score</span>
                  <span className="font-black font-mono text-lg">{totalScore}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-muted-foreground text-sm">Terminal Average</span>
                  <span className="font-black font-mono text-lg">{reportCard.overallAverage}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-muted-foreground text-sm">Class Position</span>
                  <span className="font-black font-mono text-lg">
                    {reportCard.overallPosition}{" "}
                    <span className="text-xs text-muted-foreground font-sans font-normal">
                      of {reportCard.totalStudents} students
                    </span>
                  </span>
                </div>
              </div>
            </div>
            {reportCard.reportCardStatus === "published" && (
              <div className="mt-6 pt-4 border-t border-border flex items-center gap-2 text-xs font-semibold text-primary dark:text-primary print:hidden">
                <ShieldCheck className="w-4 h-4" /> Authenticated by Taifa Ebenezer School
              </div>
            )}
          </div>

          {/* Signature Boxes */}
          <div className="border border-border/80 p-6 rounded-2xl flex flex-col justify-around gap-6 print:border-black print:rounded-none">
            <SignatureLine label="Class Teacher's Signature" />
            <SignatureLine label="Headmaster's Signature" />
          </div>
        </div>
      </div>
    </Card>
  );
}

function InfoItem({ label, value, highlight = false }: { label: string; value?: string | null; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0 print:border-black">
      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider print:text-black">{label}:</span>
      <span className={`font-bold text-sm ${highlight ? "text-primary font-black text-base print:text-black" : "text-foreground"}`}>
        {value || "—"}
      </span>
    </div>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div className="text-center w-full">
      <div className="h-8 border-b-2 border-dashed border-border/80 w-3/4 mx-auto mb-2 print:border-black" />
      <p className="font-bold text-xs text-muted-foreground uppercase tracking-wider print:text-black">{label}</p>
    </div>
  );
}
