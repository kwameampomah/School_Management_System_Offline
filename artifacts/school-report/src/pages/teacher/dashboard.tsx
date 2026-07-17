import React, { useState, useMemo } from "react";
import { Link } from "wouter";
import { useGetTeacherDashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, BookOpen, AlertCircle, CheckCircle, Edit3, Users, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function TeacherDashboard() {
  const { data: summary, isLoading } = useGetTeacherDashboardSummary();
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});

  const toggleClass = (className: string) => {
    setExpandedClasses(prev => ({
      ...prev,
      [className]: prev[className] === false ? true : false
    }));
  };

  const groupedClasses = useMemo(() => {
    if (!summary?.assignedClasses) return {};
    const groups: Record<string, typeof summary.assignedClasses> = {};
    summary.assignedClasses.forEach(cls => {
      if (!groups[cls.className]) {
        groups[cls.className] = [];
      }
      groups[cls.className].push(cls);
    });
    return groups;
  }, [summary?.assignedClasses]);

  if (isLoading) return <div><Loader2 className="w-6 h-6 animate-spin mx-auto mt-10" /></div>;
  if (!summary) return <div>Failed to load dashboard.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Welcome, {summary.teacherName}</h1>
        <p className="text-muted-foreground text-sm">Manage your classes and enter student scores.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-6">
        {/* Students Card - Neutral Container with Soft Indigo Accent */}
        <Card className="bg-card text-card-foreground border border-border/80 shadow-sm hover:shadow-md hover:border-violet-500/30 hover:-translate-y-0.5 transition-all duration-300">
          <CardContent className="p-4 sm:p-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-0">
            <div className="space-y-0.5">
              <p className="text-muted-foreground text-[11px] sm:text-sm font-medium leading-tight">Students Under Your Care</p>
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground">{summary.totalStudentsInCharge}</h2>
            </div>
            <div className="w-9 h-9 sm:w-12 sm:h-12 bg-violet-500/10 border border-violet-500/20 rounded-full flex items-center justify-center self-end sm:self-auto shrink-0">
              <BookOpen className="w-4.5 h-4.5 sm:w-6 sm:h-6 text-violet-600 dark:text-violet-400" />
            </div>
          </CardContent>
        </Card>

        {/* Pending Scores Card - High-contrast Alert/Success Tint */}
        <Card className={summary.pendingScoreEntries > 0 
          ? "bg-amber-500/5 text-amber-800 dark:text-amber-400 border border-amber-500/20 shadow-sm hover:shadow-md hover:border-amber-500/35 hover:-translate-y-0.5 transition-all duration-300"
          : "bg-card text-card-foreground border border-border/80 shadow-sm hover:shadow-md hover:border-emerald-500/30 hover:-translate-y-0.5 transition-all duration-300"
        }>
          <CardContent className="p-4 sm:p-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-0">
            <div className="space-y-0.5">
              <p className={summary.pendingScoreEntries > 0 ? "text-amber-600 dark:text-amber-400 text-[11px] sm:text-sm font-medium leading-tight" : "text-muted-foreground text-[11px] sm:text-sm font-medium leading-tight"}>
                Pending Score Entries
              </p>
              <h2 className={summary.pendingScoreEntries > 0 ? "text-2xl sm:text-4xl font-bold tracking-tight text-amber-700 dark:text-amber-300" : "text-2xl sm:text-4xl font-bold tracking-tight text-foreground"}>
                {summary.pendingScoreEntries}
              </h2>
            </div>
            <div className={summary.pendingScoreEntries > 0 
              ? "w-9 h-9 sm:w-12 sm:h-12 bg-amber-500/15 border border-amber-500/25 rounded-full flex items-center justify-center self-end sm:self-auto shrink-0"
              : "w-9 h-9 sm:w-12 sm:h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center self-end sm:self-auto shrink-0"
            }>
              {summary.pendingScoreEntries > 0 
                ? <AlertCircle className="w-4.5 h-4.5 sm:w-6 sm:h-6 text-amber-600 dark:text-amber-400" /> 
                : <CheckCircle className="w-4.5 h-4.5 sm:w-6 sm:h-6 text-emerald-600 dark:text-emerald-400" />
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {summary.ledClasses && summary.ledClasses.length > 0 && (
        <Card className="border border-border/80 bg-card/40 hover:border-primary/20 transition-all duration-300">
          <CardContent className="p-5 flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div className="space-y-1 flex-1 text-center sm:text-left">
              <h3 className="font-bold text-base sm:text-lg tracking-tight flex items-center justify-center sm:justify-start gap-2">
                <Users className="w-5 h-5 text-primary" />
                Class Teacher Hub ({summary.ledClasses.map(c => c.className).join(", ")})
              </h3>
              <p className="text-muted-foreground text-sm">
                You are registered as the Class Teacher for this class. You can manage student records, update enrollments, and publish report cards once grades are finalized.
              </p>
            </div>
            <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 flex-wrap justify-center mt-2 sm:mt-0">
              <Link href="/teacher/students">
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                  Manage Students
                </Button>
              </Link>
              <Link href="/teacher/report-cards">
                <Button size="sm" className="w-full sm:w-auto">
                  Publish Report Cards
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <h2 className="text-lg font-bold mt-8 mb-4">Your Assigned Classes</h2>
      
      {summary.assignedClasses?.length === 0 ? (
        <div className="p-8 border border-dashed rounded-lg text-center text-muted-foreground">
          You have no assigned classes for the current term. Contact an administrator.
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(groupedClasses).map(([className, subjects]) => {
            const isExpanded = expandedClasses[className] !== false;
            
            return (
              <div key={className} className="border border-border/50 bg-card/20 rounded-lg overflow-hidden transition-all duration-200">
                <button
                  onClick={() => toggleClass(className)}
                  className="w-full flex items-center justify-between p-3.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="font-bold text-sm sm:text-base text-foreground">{className}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      ({subjects.length} {subjects.length === 1 ? "subject" : "subjects"} assigned)
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </button>
                
                {isExpanded && (
                  <div className="p-4 border-t border-border/30 bg-muted/5">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {subjects.map((cls, subjIdx) => {
                        const percent = cls.totalScoresExpected > 0 ? Math.round((cls.scoresEntered / cls.totalScoresExpected) * 100) : 0;
                        const isComplete = percent === 100 && cls.totalScoresExpected > 0;
                        
                        return (
                          <Card key={subjIdx} className="border border-border/50 bg-card/40 hover:bg-card/75 hover:shadow-sm transition-all duration-200">
                            <CardContent className="p-3.5 flex items-center justify-between gap-4">
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-sm text-foreground truncate">{cls.subjectName}</span>
                                  <span 
                                    className={`inline-flex w-1.5 h-1.5 rounded-full shrink-0 ${isComplete ? "bg-emerald-500" : "bg-amber-500"}`} 
                                    title={isComplete ? "Complete" : "In Progress"} 
                                  />
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                                  <span>{cls.studentCount} students</span>
                                  <span>•</span>
                                  <span className={isComplete ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "font-semibold text-foreground/80"}>
                                    {percent}% complete
                                  </span>
                                </div>
                              </div>
                              
                              <Link href={`/teacher/scores/${cls.classId}/${encodeURIComponent(cls.subjectName)}/current`} className="shrink-0">
                                <Button variant="ghost" size="icon" className="h-8.5 w-8.5 text-muted-foreground hover:text-foreground hover:bg-muted/80">
                                  <Edit3 className="w-4 h-4" />
                                </Button>
                              </Link>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
