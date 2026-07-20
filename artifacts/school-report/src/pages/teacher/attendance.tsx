import React, { useState, useEffect, useMemo } from "react";
import { useGetMe, useListClasses, useListAcademicYears, useListTerms, useListStudents } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, CalendarCheck, CheckCircle2 } from "lucide-react";

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

  // Set default selection
  useEffect(() => {
    if (allowedClasses.length > 0 && !selectedClassId) {
      setSelectedClassId(allowedClasses[0].id.toString());
    }
  }, [allowedClasses, selectedClassId]);

  useEffect(() => {
    if (terms && terms.length > 0 && !selectedTermId) {
      const activeTerm = terms.find(t => t.isCurrent) || terms[0];
      if (activeTerm) {
        setSelectedTermId(activeTerm.id.toString());
      }
    }
  }, [terms, selectedTermId]);

  const { data: students, isLoading: isLoadingStudents } = useListStudents(
    selectedClassId ? { classId: parseInt(selectedClassId, 10) } : undefined
  );

  // Fetch existing term metadata for selected class & term
  useEffect(() => {
    if (!selectedClassId || !selectedTermId || !students) return;

    const fetchMetadata = async () => {
      setIsLoadingMetadata(true);
      try {
        const res = await fetch(`/api/student-term-metadata?termId=${selectedTermId}&classId=${selectedClassId}`);
        if (!res.ok) throw new Error("Failed to load attendance metadata");
        const existingData: any[] = await res.json();

        // Merge student list with existing metadata records
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
      } catch (err: unknown) {
        toast({ variant: "destructive", title: "Failed to load metadata records" });
      } finally {
        setIsLoadingMetadata(false);
      }
    };

    fetchMetadata();
  }, [selectedClassId, selectedTermId, students, toast]);

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-primary" />
            Attendance & Behavioral Remarks
          </h1>
          <p className="text-muted-foreground text-sm">
            Record student attendance days, conduct, attitude, and report card remarks.
          </p>
        </div>
        <Button onClick={handleSaveAll} disabled={isSaving || rows.length === 0} className="shrink-0">
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save All Changes
        </Button>
      </div>

      {/* Filter Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label>Class</Label>
              <Select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>
                <option value="">Select Class...</option>
                {allowedClasses.map(c => (
                  <option key={c.id} value={c.id.toString()}>{c.name}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Academic Term</Label>
              <Select value={selectedTermId} onChange={e => setSelectedTermId(e.target.value)}>
                <option value="">Select Term...</option>
                {terms?.map(t => (
                  <option key={t.id} value={t.id.toString()}>
                    {t.name} {t.isCurrent ? "(Current)" : ""}
                  </option>
                ))}
              </Select>
            </div>

            {rows.length > 0 && (
              <div className="space-y-2">
                <Label>Set Total Days Opened (All)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 65"
                  onChange={e => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) handleBulkDaysOpenedChange(val);
                  }}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Grid Editor Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoadingStudents || isLoadingMetadata ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-2">Loading student attendance records...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No students found for the selected class and term.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Student</TableHead>
                    <TableHead className="w-[100px]">Days Open</TableHead>
                    <TableHead className="w-[100px]">Present</TableHead>
                    <TableHead className="w-[130px]">Conduct</TableHead>
                    <TableHead className="w-[130px]">Attitude</TableHead>
                    <TableHead className="w-[130px]">Interest</TableHead>
                    <TableHead>Teacher Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => (
                    <TableRow key={row.studentId}>
                      <TableCell>
                        <div className="font-medium text-sm">{row.studentName}</div>
                        <div className="font-mono text-xs text-muted-foreground">{row.studentIdNumber}</div>
                      </TableCell>

                      <TableCell>
                        <Input
                          type="number"
                          value={row.daysOpened}
                          onChange={e => handleRowChange(row.studentId, "daysOpened", parseInt(e.target.value, 10) || 0)}
                          className="w-20"
                        />
                      </TableCell>

                      <TableCell>
                        <Input
                          type="number"
                          value={row.daysPresent}
                          onChange={e => handleRowChange(row.studentId, "daysPresent", parseInt(e.target.value, 10) || 0)}
                          className="w-20"
                        />
                      </TableCell>

                      <TableCell>
                        <Select
                          value={row.conduct}
                          onChange={e => handleRowChange(row.studentId, "conduct", e.target.value)}
                        >
                          <option value="Excellent">Excellent</option>
                          <option value="Good">Good</option>
                          <option value="Satisfactory">Satisfactory</option>
                          <option value="Needs Improvement">Needs Imp.</option>
                        </Select>
                      </TableCell>

                      <TableCell>
                        <Select
                          value={row.attitude}
                          onChange={e => handleRowChange(row.studentId, "attitude", e.target.value)}
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
                          onChange={e => handleRowChange(row.studentId, "interest", e.target.value)}
                        >
                          <option value="High">High</option>
                          <option value="Average">Average</option>
                          <option value="Developing">Developing</option>
                        </Select>
                      </TableCell>

                      <TableCell>
                        <Input
                          value={row.teacherRemarks}
                          onChange={e => handleRowChange(row.studentId, "teacherRemarks", e.target.value)}
                          placeholder="Class Teacher Remarks for Report Card..."
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
