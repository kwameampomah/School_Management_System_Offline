import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useGetMe, useListClasses, useListAcademicYears, useListTerms, useListStudents } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, CalendarCheck } from "lucide-react";

interface StudentMetadataState {
  studentId: number;
  studentName: string;
  studentIdNumber: string;
  daysOpened: number;
  daysPresent: number;
  conduct: string;
  attitude: string;
  interest: string;
  teacherRemarks: string;
}

export default function AttendancePage() {
  const { data: user } = useGetMe();
  const { data: classes } = useListClasses();
  const { data: years } = useListAcademicYears();
  const { data: terms } = useListTerms();
  
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [rows, setRows] = useState<StudentMetadataState[]>([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const { toast } = useToast();

  // Find classes allowed for current user
  const allowedClasses = useMemo(() => {
    if (!classes) return [];
    if (user?.role === "admin") return classes;
    if (user?.role === "teacher") {
      return classes.filter(cls => cls.classTeacherId === user.teacherId);
    }
    return [];
  }, [classes, user]);

  // Set default class selection
  useEffect(() => {
    if (allowedClasses.length > 0 && !selectedClassId) {
      setSelectedClassId(allowedClasses[0].id.toString());
    }
  }, [allowedClasses, selectedClassId]);

  // Set default term selection
  useEffect(() => {
    if (terms && terms.length > 0 && !selectedTermId) {
      const activeTerm = terms.find(t => t.isCurrent) || terms[0];
      if (activeTerm) {
        setSelectedTermId(activeTerm.id.toString());
      }
    }
  }, [terms, selectedTermId]);

  // Memoize query params to avoid object reference churn
  const studentsQueryParams = useMemo(() => {
    return selectedClassId ? { classId: parseInt(selectedClassId, 10) } : undefined;
  }, [selectedClassId]);

  const { data: students, isLoading: isLoadingStudents } = useListStudents(studentsQueryParams);

  // Create primitive string key for student list to prevent infinite re-fetches
  const studentIdsKey = useMemo(() => {
    return students ? students.map(s => s.id).join(",") : "";
  }, [students]);

  // Fetch existing term metadata for selected class & term
  useEffect(() => {
    if (!selectedClassId || !selectedTermId || !students || students.length === 0) {
      if (students && students.length === 0) setRows([]);
      return;
    }

    let isMounted = true;
    setIsLoadingMetadata(true);

    fetch(`/api/student-term-metadata?termId=${selectedTermId}&classId=${selectedClassId}`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to load metadata");
        return res.json();
      })
      .then((existingData: any[]) => {
        if (!isMounted) return;
        const initialRows: StudentMetadataState[] = students.map(s => {
          const match = existingData.find(e => e.studentId === s.id);
          return {
            studentId: s.id,
            studentName: s.fullName,
            studentIdNumber: s.studentIdNumber,
            daysOpened: match?.daysOpened ?? 65,
            daysPresent: match?.daysPresent ?? 65,
            conduct: match?.conduct ?? "Good",
            attitude: match?.attitude ?? "Attentive",
            interest: match?.interest ?? "High",
            teacherRemarks: match?.teacherRemarks ?? "A hardworking and pleasant student.",
          };
        });
        setRows(initialRows);
      })
      .catch(() => {
        if (isMounted) {
          toast({ variant: "destructive", title: "Failed to load metadata records" });
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingMetadata(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedClassId, selectedTermId, studentIdsKey]); // Depend strictly on primitives!

  const handleRowChange = (studentId: number, field: keyof StudentMetadataState, value: any) => {
    setRows(prev =>
      prev.map(r => (r.studentId === studentId ? { ...r, [field]: value } : r))
    );
  };

  const handleBulkDaysOpenedChange = (val: number) => {
    setRows(prev => prev.map(r => ({ ...r, daysOpened: val })));
  };

  const handleSaveAll = async () => {
    if (!selectedTermId) return;

    setIsSaving(true);
    let successCount = 0;

    try {
      for (const row of rows) {
        const payload = {
          studentId: row.studentId,
          termId: parseInt(selectedTermId, 10),
          daysOpened: Number(row.daysOpened),
          daysPresent: Number(row.daysPresent),
          conduct: row.conduct || undefined,
          attitude: row.attitude || undefined,
          interest: row.interest || undefined,
          teacherRemarks: row.teacherRemarks || undefined,
        };

        const res = await fetch("/api/student-term-metadata", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) successCount++;
      }

      toast({
        title: "Attendance & Remarks Saved",
        description: `Successfully updated ${successCount} student records.`,
      });
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Error saving records" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarCheck className="w-7 h-7 text-primary" /> Attendance & Remarks Management
          </h1>
          <p className="text-muted-foreground text-sm">
            Batch enter learner attendance days, conduct, attitude, interest, and term teacher remarks.
          </p>
        </div>
        <Button onClick={handleSaveAll} disabled={isSaving || rows.length === 0} size="lg" className="shrink-0 shadow-md">
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save All Changes
        </Button>
      </div>

      {/* Filter Options */}
      <Card className="border border-border/80 shadow-sm">
        <CardContent className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Select Class</Label>
            <Select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
              {allowedClasses.map(c => (
                <option key={c.id} value={c.id.toString()}>{c.name}</option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Select Academic Term</Label>
            <Select value={selectedTermId} onChange={(e) => setSelectedTermId(e.target.value)}>
              {terms?.map(t => (
                <option key={t.id} value={t.id.toString()}>{t.name} ({t.academicYearLabel})</option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Set Total School Days for All</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                placeholder="65"
                defaultValue={rows[0]?.daysOpened || 65}
                onChange={(e) => handleBulkDaysOpenedChange(parseInt(e.target.value, 10) || 65)}
                className="w-28 font-mono"
              />
              <span className="text-xs text-muted-foreground">Days</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance & Remarks Grid Table */}
      <Card className="border border-border/80 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/40 px-6 py-4 border-b border-border/60">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span>Student Term Records ({rows.length})</span>
            {isLoadingMetadata && <span className="text-xs text-muted-foreground flex items-center"><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Loading data...</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoadingStudents || (isLoadingMetadata && rows.length === 0) ? (
            <div className="py-16 text-center text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
              Loading student roster...
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              No students found in the selected class.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead className="w-48">Student Name</TableHead>
                  <TableHead className="w-24 text-center">Days Opened</TableHead>
                  <TableHead className="w-24 text-center">Days Present</TableHead>
                  <TableHead className="w-32">Conduct</TableHead>
                  <TableHead className="w-32">Attitude</TableHead>
                  <TableHead className="w-32">Interest</TableHead>
                  <TableHead>Teacher's Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={row.studentId} className="hover:bg-muted/20">
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-sm">{row.studentName}</div>
                      <div className="text-xs text-muted-foreground font-mono">{row.studentIdNumber}</div>
                    </TableCell>

                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min="1"
                        value={row.daysOpened}
                        onChange={(e) => handleRowChange(row.studentId, "daysOpened", parseInt(e.target.value, 10) || 0)}
                        className="w-20 mx-auto text-center font-mono text-sm"
                      />
                    </TableCell>

                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min="0"
                        max={row.daysOpened}
                        value={row.daysPresent}
                        onChange={(e) => handleRowChange(row.studentId, "daysPresent", parseInt(e.target.value, 10) || 0)}
                        className="w-20 mx-auto text-center font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400"
                      />
                    </TableCell>

                    <TableCell>
                      <Select
                        value={row.conduct}
                        onChange={(e) => handleRowChange(row.studentId, "conduct", e.target.value)}
                        className="text-xs"
                      >
                        <option value="Excellent">Excellent</option>
                        <option value="Good">Good</option>
                        <option value="Satisfactory">Satisfactory</option>
                        <option value="Needs Imp.">Needs Imp.</option>
                      </Select>
                    </TableCell>

                    <TableCell>
                      <Select
                        value={row.attitude}
                        onChange={(e) => handleRowChange(row.studentId, "attitude", e.target.value)}
                        className="text-xs"
                      >
                        <option value="Enthusiastic">Enthusiastic</option>
                        <option value="Attentive">Attentive</option>
                        <option value="Distracted">Distracted</option>
                        <option value="Passive">Passive</option>
                      </Select>
                    </TableCell>

                    <TableCell>
                      <Select
                        value={row.interest}
                        onChange={(e) => handleRowChange(row.studentId, "interest", e.target.value)}
                        className="text-xs"
                      >
                        <option value="High">High</option>
                        <option value="Average">Average</option>
                        <option value="Developing">Developing</option>
                      </Select>
                    </TableCell>

                    <TableCell>
                      <Input
                        type="text"
                        value={row.teacherRemarks}
                        onChange={(e) => handleRowChange(row.studentId, "teacherRemarks", e.target.value)}
                        placeholder="Enter remarks..."
                        className="text-xs"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
