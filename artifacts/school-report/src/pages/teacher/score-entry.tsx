import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRoute, Link } from "wouter";
import { 
  useListStudents, 
  useListAssessmentComponents, 
  useListScores, 
  useUpsertScore,
  useListTerms,
  useGetClass
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListScoresQueryKey } from "@workspace/api-client-react";
import { Loader2, ArrowLeft, Save, Check, Download, Upload, Search } from "lucide-react";

export default function ScoreEntryPage() {
  const [, params] = useRoute("/teacher/scores/:classId/:subjectName/:termId");
  const classId = parseInt(params?.classId || "0");
  const subjectName = decodeURIComponent(params?.subjectName || "");
  let termIdParam = params?.termId;
  
  const { data: terms } = useListTerms();
  const currentTermId = terms?.find(t => t.isCurrent)?.id;
  
  const termId = termIdParam === "current" ? currentTermId : parseInt(termIdParam || "0");

  const { data: cls } = useGetClass(classId, { query: { enabled: !!classId, queryKey: ['class', classId] }});
  
  // We need to find the classSubjectId for the given subject name and class.
  // The backend API `listAssessmentComponents` allows filtering by `termId` and `subjectId` or `classSubjectId`. 
  // Let's get the components for this term and class matching the subject name.
  // The API doesn't have a direct "getClassSubjectIdByName", but listAssessmentComponents returns them.
  // Actually, wait, listAssessmentComponents needs termId and maybe we can just pass them and get all, then filter by subjectName client side.
  const { data: allComponents, isLoading: compsLoading } = useListAssessmentComponents(
    { termId },
    { query: { enabled: !!termId, queryKey: ['listAssessmentComponents', { termId }] } }
  );
  const components = allComponents?.filter(c => c.subjectName === subjectName) || [];

  const { data: students, isLoading: studentsLoading } = useListStudents(
    { classId }, 
    { query: { enabled: !!classId, queryKey: ['listStudents', { classId }] } }
  );

  const { data: scoresData, isLoading: scoresLoading } = useListScores(
    { termId, classId },
    { query: { enabled: !!termId && !!classId, queryKey: ['listScores', { termId, classId }] } }
  );

  // Filter scores to just those matching our components
  const componentIds = components.map(c => c.id);
  const scores = scoresData?.filter(s => componentIds.includes(s.assessmentComponentId)) || [];

  const [localScores, setLocalScores] = useState<Record<string, number | "">>({});
  const [savingStatus, setSavingStatus] = useState<Record<string, "saving" | "saved" | "error">>({});
  const [isImporting, setIsImporting] = useState(false);

  // Calculate totals per student
  const getStudentTotal = useCallback((studentId: number) => {
    let total = 0;
    components.forEach(c => {
      const key = `${studentId}-${c.id}`;
      const val = localScores[key];
      const actualVal = val !== "" && val !== undefined ? val : (scores.find(s => s.studentId === studentId && s.assessmentComponentId === c.id)?.scoreValue || 0);
      
      // Calculate weighted portion
      const weighted = (actualVal / c.maxScore) * c.weightPercent;
      total += weighted;
    });
    return Math.round(total * 10) / 10;
  }, [components, localScores, scores]);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"name" | "total" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const processedStudents = useMemo(() => {
    if (!students) return [];
    
    // 1. Filter
    let list = students.filter(student => 
      student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.studentIdNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    // 2. Sort
    if (sortField === "name") {
      list.sort((a, b) => {
        const compare = a.fullName.localeCompare(b.fullName);
        return sortDirection === "asc" ? compare : -compare;
      });
    } else if (sortField === "total") {
      list.sort((a, b) => {
        const totalA = getStudentTotal(a.id);
        const totalB = getStudentTotal(b.id);
        return sortDirection === "asc" ? totalA - totalB : totalB - totalA;
      });
    }
    
    return list;
  }, [students, searchQuery, sortField, sortDirection, getStudentTotal]);
  
  const upsertScore = useUpsertScore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const upsertScoreMutate = useRef(upsertScore.mutate);
  upsertScoreMutate.current = upsertScore.mutate;

  // Initialize local state from server
  const initialized = useRef(false);
  useEffect(() => {
    if (scores && !initialized.current && scores.length > 0) {
      const initialMap: Record<string, number> = {};
      scores.forEach(s => {
        initialMap[`${s.studentId}-${s.assessmentComponentId}`] = s.scoreValue;
      });
      setLocalScores(prev => ({ ...initialMap, ...prev }));
      initialized.current = true; // only init once, let user edits take over
    }
  }, [scores]);

  const handleScoreChange = (studentId: number, compId: number, value: string) => {
    const key = `${studentId}-${compId}`;
    let numVal: number | "" = "";
    if (value !== "") {
      numVal = parseFloat(value);
      if (isNaN(numVal)) numVal = "";
    }
    setLocalScores(prev => ({ ...prev, [key]: numVal }));
  };

  const handleScoreBlur = (studentId: number, compId: number, compMax: number) => {
    const key = `${studentId}-${compId}`;
    const value = localScores[key];
    
    if (value === "" || value === undefined) return;
    
    if (value < 0 || value > compMax) {
      toast({ variant: "destructive", title: "Invalid Score", description: `Score must be between 0 and ${compMax}` });
      return;
    }

    const existingScore = scores?.find(s => s.studentId === studentId && s.assessmentComponentId === compId);
    if (existingScore && existingScore.scoreValue === value) return; // no change

    setSavingStatus(prev => ({ ...prev, [key]: "saving" }));
    
    upsertScoreMutate.current({ 
      data: { studentId, assessmentComponentId: compId, scoreValue: value as number } 
    }, {
      onSuccess: () => {
        setSavingStatus(prev => ({ ...prev, [key]: "saved" }));
        queryClient.invalidateQueries({ queryKey: getListScoresQueryKey({ termId, classId }) });
        setTimeout(() => {
          setSavingStatus(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }, 2000);
      },
      onError: () => {
        setSavingStatus(prev => ({ ...prev, [key]: "error" }));
        toast({ variant: "destructive", title: "Failed to save score" });
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, studentIdx: number, compIdx: number) => {
    let nextStudentIdx = studentIdx;
    let nextCompIdx = compIdx;

    if (e.key === "Enter") {
      e.preventDefault();
      nextStudentIdx = studentIdx + 1;
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      nextStudentIdx = studentIdx + 1;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      nextStudentIdx = studentIdx - 1;
    } else if (e.key === "ArrowRight") {
      nextCompIdx = compIdx + 1;
    } else if (e.key === "ArrowLeft") {
      nextCompIdx = compIdx - 1;
    } else {
      return;
    }

    const nextInput = document.querySelector<HTMLInputElement>(
      `input[data-student-idx="${nextStudentIdx}"][data-comp-idx="${nextCompIdx}"]`
    );
    if (nextInput) {
      nextInput.focus();
      nextInput.select();
    }
  };

  const handleExportCSV = () => {
    if (!processedStudents || !components) return;

    // Header row
    const headers = [
      "Student ID Number",
      "Full Name",
      ...components.map(c => `"${c.name} (Max ${c.maxScore})"`),
    ];

    // Data rows
    const rows = processedStudents.map(student => {
      const line = [
        student.studentIdNumber,
        `"${student.fullName.replace(/"/g, '""')}"`, // escape quotes in name
        ...components.map(c => {
          const key = `${student.id}-${c.id}`;
          const val = localScores[key];
          const displayVal = val !== undefined && val !== "" ? val : (scores.find(s => s.studentId === student.id && s.assessmentComponentId === c.id)?.scoreValue ?? "");
          return displayVal;
        }),
      ];
      return line.join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Score_Entry_${subjectName.replace(/\s+/g, '_')}_${cls?.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      try {
        setIsImporting(true);
        
        // Simple CSV parser
        const lines = text.split(/\r?\n/).map(line => {
          const result = [];
          let current = "";
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = "";
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        }).filter(line => line.length > 0 && line.some(cell => cell !== ""));

        if (lines.length < 2) {
          toast({ variant: "destructive", title: "Empty CSV", description: "The CSV file does not contain any data rows." });
          return;
        }

        const headers = lines[0];
        
        // Find column indices
        const studentIdIdx = headers.findIndex(h => h.toLowerCase().includes("student id"));
        if (studentIdIdx === -1) {
          toast({ variant: "destructive", title: "Invalid CSV Format", description: "Could not find 'Student ID Number' column." });
          return;
        }

        // Map component columns
        const compColumnMappings: Array<{ compId: number; colIdx: number; name: string; maxScore: number }> = [];
        components.forEach(comp => {
          const idx = headers.findIndex(h => {
            const cleanHeader = h.toLowerCase().replace(/[^a-z0-9]/g, "");
            const cleanCompName = comp.name.toLowerCase().replace(/[^a-z0-9]/g, "");
            return cleanHeader.startsWith(cleanCompName) || cleanHeader.includes(cleanCompName);
          });
          
          if (idx !== -1) {
            compColumnMappings.push({
              compId: comp.id,
              colIdx: idx,
              name: comp.name,
              maxScore: comp.maxScore
            });
          }
        });

        if (compColumnMappings.length === 0) {
          toast({ variant: "destructive", title: "No Matching Columns", description: "No column headers matched the assessment components for this subject." });
          return;
        }

        const payload: Array<{ studentId: number; assessmentComponentId: number; scoreValue: number }> = [];
        const localScoresUpdate: Record<string, number> = {};
        const errors: string[] = [];

        // Parse rows
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i];
          const idNum = row[studentIdIdx];
          if (!idNum) continue;

          // Find student
          const student = students?.find(s => s.studentIdNumber.toLowerCase() === idNum.toLowerCase());
          if (!student) {
            errors.push(`Row ${i + 1}: Student with ID '${idNum}' not found in this class.`);
            continue;
          }

          compColumnMappings.forEach(mapping => {
            const rawValue = row[mapping.colIdx];
            if (rawValue === undefined || rawValue === "") return;

            const numericVal = parseFloat(rawValue);
            if (isNaN(numericVal)) {
              errors.push(`Row ${i + 1} (${student.fullName}): Invalid numeric score '${rawValue}' for ${mapping.name}.`);
              return;
            }

            if (numericVal < 0 || numericVal > mapping.maxScore) {
              errors.push(`Row ${i + 1} (${student.fullName}): Score ${numericVal} for ${mapping.name} is out of bounds (max is ${mapping.maxScore}).`);
              return;
            }

            payload.push({
              studentId: student.id,
              assessmentComponentId: mapping.compId,
              scoreValue: numericVal,
            });

            localScoresUpdate[`${student.id}-${mapping.compId}`] = numericVal;
          });
        }

        if (payload.length === 0) {
          toast({ 
            variant: "destructive", 
            title: "No Scores to Import", 
            description: errors.length > 0 ? "All rows failed validation. Details:\n" + errors.slice(0, 3).join("\n") : "No valid scores were found in the file." 
          });
          return;
        }

        // Call the bulk update API
        const response = await fetch("/api/scores/bulk", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ scores: payload }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to submit scores bulk request.");
        }

        // Update local state and trigger refetch
        setLocalScores(prev => ({ ...prev, ...localScoresUpdate }));
        queryClient.invalidateQueries({ queryKey: getListScoresQueryKey({ termId, classId }) });

        toast({
          title: "Import Successful",
          description: `Successfully imported ${payload.length} score entries.` + 
            (errors.length > 0 ? `\nNote: ${errors.length} rows had errors and were skipped.` : "")
        });

        if (errors.length > 0) {
          console.warn("CSV Import Errors:", errors);
        }
      } catch (err: any) {
        toast({ variant: "destructive", title: "Import Failed", description: err.message || "An unexpected error occurred during CSV import." });
      } finally {
        setIsImporting(false);
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  const isLoading = compsLoading || studentsLoading || scoresLoading || !termId;

  if (isLoading) return <div><Loader2 className="w-6 h-6 animate-spin mx-auto mt-10" /></div>;

  if (components.length === 0) {
    return (
      <div className="space-y-4">
        <Link href="/teacher" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </Link>
        <Card className="p-12 text-center text-muted-foreground border-dashed">
          No assessment components configured for {subjectName} in this term. Contact administrator.
        </Card>
      </div>
    );
  }



  return (
    <div className="space-y-6">
      <div>
        <Link href="/teacher" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-2">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </Link>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Score Entry: <span className="break-all">{subjectName}</span></h1>
            <p className="text-muted-foreground text-sm">{cls?.name} • Scores auto-save when you leave a cell.</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="w-4 h-4 mr-2" /> Export Template
            </Button>
            <div className="relative">
              <input
                type="file"
                accept=".csv"
                id="csv-upload"
                className="hidden"
                onChange={handleImportCSV}
                disabled={isImporting}
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => document.getElementById('csv-upload')?.click()}
                disabled={isImporting}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" /> Import CSV
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 bg-muted/20 p-3 sm:p-4 rounded-lg border">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Search students by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button
            variant={sortField === "name" ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              if (sortField === "name") {
                setSortDirection(prev => prev === "asc" ? "desc" : "asc");
              } else {
                setSortField("name");
                setSortDirection("asc");
              }
            }}
          >
            Sort by Name {sortField === "name" && (sortDirection === "asc" ? "↑" : "↓")}
          </Button>
          <Button
            variant={sortField === "total" ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              if (sortField === "total") {
                setSortDirection(prev => prev === "asc" ? "desc" : "asc");
              } else {
                setSortField("total");
                setSortDirection("desc");
              }
            }}
          >
            Sort by Total {sortField === "total" && (sortDirection === "asc" ? "↑" : "↓")}
          </Button>
          {(sortField || searchQuery) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSortField(null);
              }}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Desktop Version: Excel-like Grid Table */}
      <Card className="overflow-hidden hidden sm:block">
        <div className="overflow-x-auto">
          <div className="max-h-[65vh] overflow-y-auto relative">
            <Table className="min-w-max">
              <TableHeader className="sticky top-0 z-20 bg-background">
                <TableRow>
                  <TableHead className="w-[160px] sm:w-[220px] sticky left-0 bg-muted/50 border-r shadow-[1px_0_0_0_#e2e8f0] z-10">Student</TableHead>
                  {components.map(c => (
                    <TableHead key={c.id} className="text-center min-w-[120px]">
                      <div>{c.name}</div>
                      <div className="text-xs font-normal text-muted-foreground">Max: {c.maxScore} | {c.weightPercent}%</div>
                    </TableHead>
                  ))}
                  <TableHead className="text-center bg-muted/50 min-w-[100px] font-bold text-primary">Weighted Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedStudents.length === 0 && (
                  <TableRow><TableCell colSpan={components.length + 2} className="text-center">No students found.</TableCell></TableRow>
                )}
                {processedStudents.map((student, idx) => (
                  <TableRow key={student.id} className={`${idx % 2 === 0 ? "bg-background" : "bg-muted/10"} hover:bg-muted/30 transition-colors`}>
                    <TableCell className="font-medium w-[160px] sm:w-[220px] sticky left-0 border-r shadow-[1px_0_0_0_#e2e8f0] z-10" style={{ backgroundColor: idx % 2 === 0 ? "hsl(var(--background))" : "hsl(var(--muted) / 0.1)" }}>
                      <div className="truncate" title={student.fullName}>{student.fullName}</div>
                      <div className="text-xs text-muted-foreground font-mono">{student.studentIdNumber}</div>
                    </TableCell>
                    
                    {components.map((c, cIdx) => {
                      const key = `${student.id}-${c.id}`;
                      const status = savingStatus[key];
                      const val = localScores[key];
                      const displayVal = val !== undefined ? val : (scores.find(s => s.studentId === student.id && s.assessmentComponentId === c.id)?.scoreValue ?? "");
                      
                      return (
                        <TableCell key={c.id} className="text-center relative">
                          <div className="relative max-w-[80px] mx-auto">
                            <Input 
                              type="number" 
                              min={0} 
                              max={c.maxScore}
                              value={displayVal}
                              onChange={(e) => handleScoreChange(student.id, c.id, e.target.value)}
                              onBlur={() => handleScoreBlur(student.id, c.id, c.maxScore)}
                              onKeyDown={(e) => handleKeyDown(e, idx, cIdx)}
                              data-student-idx={idx}
                              data-comp-idx={cIdx}
                              className={`text-center font-mono pr-6 ${status === 'error' ? 'border-destructive' : ''}`}
                            />
                            {status === "saving" && <Loader2 className="w-3 h-3 animate-spin absolute right-2 top-3.5 text-muted-foreground" />}
                            {status === "saved" && <Check className="w-3 h-3 absolute right-2 top-3.5 text-green-600" />}
                          </div>
                        </TableCell>
                      );
                    })}
                    
                    <TableCell className="text-center bg-muted/30 font-bold font-mono text-lg">
                      {getStudentTotal(student.id)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>

      {/* Mobile Version: Responsive Card List */}
      <div className="space-y-3 sm:hidden">
        {processedStudents.length === 0 && (
          <div className="text-center text-muted-foreground py-10 border border-dashed rounded-xl bg-card/20">
            No students found.
          </div>
        )}
        {processedStudents.map((student, idx) => (
          <Card key={student.id} className="p-4 bg-card/30 border border-border/60 shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center justify-between border-b border-border/60 pb-2.5 mb-3">
              <div>
                <h3 className="font-semibold text-sm text-foreground">{student.fullName}</h3>
                <span className="font-mono text-[10px] text-muted-foreground">{student.studentIdNumber}</span>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] text-muted-foreground block uppercase tracking-wider leading-none">Weighted Total</span>
                <span className="font-mono font-bold text-primary text-base leading-none">{getStudentTotal(student.id)}%</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-2.5">
              {components.map((c, cIdx) => {
                const key = `${student.id}-${c.id}`;
                const status = savingStatus[key];
                const val = localScores[key];
                const displayVal = val !== undefined ? val : (scores.find(s => s.studentId === student.id && s.assessmentComponentId === c.id)?.scoreValue ?? "");
                
                return (
                  <div key={c.id} className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-foreground block truncate">{c.name}</span>
                      <span className="text-[10px] text-muted-foreground">Max: {c.maxScore} | {c.weightPercent}% weight</span>
                    </div>
                    <div className="relative w-24 shrink-0">
                      <Input 
                        type="number" 
                        min={0} 
                        max={c.maxScore}
                        value={displayVal}
                        onChange={(e) => handleScoreChange(student.id, c.id, e.target.value)}
                        onBlur={() => handleScoreBlur(student.id, c.id, c.maxScore)}
                        onKeyDown={(e) => handleKeyDown(e, idx, cIdx)}
                        data-student-idx={idx}
                        data-comp-idx={cIdx}
                        className={`text-center font-mono h-8 pr-6 text-xs ${status === 'error' ? 'border-destructive' : ''}`}
                      />
                      {status === "saving" && <Loader2 className="w-3 h-3 animate-spin absolute right-2 top-2.5 text-muted-foreground" />}
                      {status === "saved" && <Check className="w-3 h-3 absolute right-2 top-2.5 text-green-600" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
