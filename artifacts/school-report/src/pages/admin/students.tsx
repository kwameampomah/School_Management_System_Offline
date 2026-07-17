import React, { useState } from "react";
import { useListStudents, useCreateStudent, useUpdateStudent, useDeleteStudent, useListClasses, useGetMe, useListTeacherAssignments } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListStudentsQueryKey, StudentInputGender } from "@workspace/api-client-react";
import { Loader2, Plus, Pencil, Trash2, Upload, Download } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function StudentsPage() {
  const { data: user } = useGetMe();
  const { data: classes } = useListClasses();
  const { data: assignments } = useListTeacherAssignments(
    user?.role === "teacher" && user.teacherId ? { teacherId: user.teacherId } : undefined
  );
  
  // Find classes this user is allowed to view/manage
  const allowedClasses = React.useMemo(() => {
    if (!classes) return [];
    if (user?.role === "admin") return classes;
    if (user?.role === "teacher") {
      return classes.filter(cls => {
        // 1. Is class teacher
        if (cls.classTeacherId === user.teacherId) return true;
        // 2. Is subject teacher (match class by name)
        return assignments?.some(a => a.className === cls.name);
      });
    }
    return [];
  }, [classes, user, assignments]);

  const teacherLedClassId = classes?.find(cls => user?.role === "teacher" && cls.classTeacherId === user.teacherId)?.id;
  
  const [classFilter, setClassFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Automatically select the first allowed class
  React.useEffect(() => {
    if (user?.role === "teacher" && allowedClasses.length > 0 && !classFilter) {
      const preferred = allowedClasses.find(cls => cls.classTeacherId === user.teacherId) || allowedClasses[0];
      if (preferred) {
        setClassFilter(preferred.id.toString());
      }
    }
  }, [user, allowedClasses, classFilter]);

  const isClassTeacherOfSelectedClass = React.useMemo(() => {
    if (user?.role === "admin") return true;
    if (user?.role === "teacher" && classFilter) {
      const selectedCls = classes?.find(cls => cls.id === parseInt(classFilter));
      return selectedCls?.classTeacherId === user.teacherId;
    }
    return false;
  }, [user, classes, classFilter]);

  const { data: students, isLoading } = useListStudents(classFilter ? { classId: parseInt(classFilter) } : undefined);

  const [sortField, setSortField] = useState<"name" | "id" | "gender" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const filteredStudents = React.useMemo(() => {
    if (!students) return [];
    return students.filter(student => 
      student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.studentIdNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [students, searchQuery]);

  const sortedStudents = React.useMemo(() => {
    let list = [...filteredStudents];
    if (!sortField) return list;
    
    list.sort((a, b) => {
      let valA = "";
      let valB = "";
      
      if (sortField === "name") {
        valA = a.fullName || "";
        valB = b.fullName || "";
      } else if (sortField === "id") {
        valA = a.studentIdNumber || "";
        valB = b.studentIdNumber || "";
      } else if (sortField === "gender") {
        valA = a.gender || "";
        valB = b.gender || "";
      }
      
      const compare = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      return sortDirection === "asc" ? compare : -compare;
    });
    
    return list;
  }, [filteredStudents, sortField, sortDirection]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const deleteStudent = useDeleteStudent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (isLoading) return <div><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this student? All their scores and report cards will be lost.")) return;
    deleteStudent.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Deleted successfully" });
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Students</h1>
            <p className="text-muted-foreground text-sm hidden sm:block">Manage student enrollments and class allocations.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select 
              value={classFilter} 
              onChange={e => setClassFilter(e.target.value)} 
              className="w-full sm:w-44"
              disabled={user?.role === "teacher" && allowedClasses.length <= 1}
            >
              {user?.role === "admin" && <option value="">All Classes</option>}
              {allowedClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Button 
              onClick={() => setIsImportOpen(true)} 
              variant="outline" 
              size="sm" 
              className="shrink-0"
              disabled={!isClassTeacherOfSelectedClass}
            >
              <Upload className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Import CSV</span>
              <span className="sm:hidden">Import</span>
            </Button>
            <Button 
              onClick={() => setIsCreateOpen(true)} 
              size="sm" 
              className="shrink-0"
              disabled={!isClassTeacherOfSelectedClass}
            >
              <Plus className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Add Student</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>

        {/* Search & Sort Toolbar */}
        <div className="flex flex-col gap-3 bg-muted/20 p-3 sm:p-4 rounded-lg border">
          <div className="relative w-full">
            <Input 
              placeholder="Search students by name or ID..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-background"
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
              variant={sortField === "id" ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                if (sortField === "id") {
                  setSortDirection(prev => prev === "asc" ? "desc" : "asc");
                } else {
                  setSortField("id");
                  setSortDirection("asc");
                }
              }}
            >
              Sort by ID {sortField === "id" && (sortDirection === "asc" ? "↑" : "↓")}
            </Button>
            <Button
              variant={sortField === "gender" ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                if (sortField === "gender") {
                  setSortDirection(prev => prev === "asc" ? "desc" : "asc");
                } else {
                  setSortField("gender");
                  setSortDirection("asc");
                }
              }}
            >
              Sort by Gender {sortField === "gender" && (sortDirection === "asc" ? "↑" : "↓")}
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
      </div>

      {/* Desktop Version: Table Layout */}
      <Card className="hidden sm:block">
        <div className="overflow-x-auto">
          <Table className="min-w-[480px]">
            <TableHeader>
              <TableRow>
                <TableHead>Student ID</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="hidden sm:table-cell">Gender</TableHead>
                <TableHead className="hidden md:table-cell">Guardian</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedStudents.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No students found.</TableCell></TableRow>
              )}
              {sortedStudents.map(student => (
                <TableRow key={student.id}>
                  <TableCell className="font-mono text-xs">{student.studentIdNumber}</TableCell>
                  <TableCell className="font-medium">{student.fullName}</TableCell>
                  <TableCell className="text-sm">{student.className}</TableCell>
                  <TableCell className="hidden sm:table-cell capitalize text-sm">{student.gender || "-"}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="text-sm">{student.guardianName || "-"}</div>
                    <div className="text-xs text-muted-foreground">{student.guardianPhone || ""}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditingStudent(student)} disabled={!isClassTeacherOfSelectedClass}><Pencil className="w-4 h-4 text-muted-foreground" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(student.id)} disabled={!isClassTeacherOfSelectedClass}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Mobile Version: Responsive Card Grid */}
      <div className="grid grid-cols-1 gap-2.5 sm:hidden">
        {sortedStudents.length === 0 && (
          <div className="text-center text-muted-foreground py-10 border border-dashed rounded-xl bg-card/20">
            No students found.
          </div>
        )}
        {sortedStudents.map(student => (
          <div 
            key={student.id} 
            className="border border-border/50 bg-card/30 px-3 py-2.5 rounded-lg flex items-center justify-between gap-3 shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-foreground truncate">{student.fullName}</h3>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 leading-none shrink-0">{student.className}</Badge>
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                <span className="font-mono text-[10px]">{student.studentIdNumber}</span>
                <span>•</span>
                <span className="capitalize">{student.gender || "-"}</span>
                {student.guardianPhone && (
                  <>
                    <span>•</span>
                    <span className="truncate">{student.guardianPhone}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-8 h-8 rounded-full" 
                onClick={() => setEditingStudent(student)} 
                disabled={!isClassTeacherOfSelectedClass}
              >
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-8 h-8 rounded-full text-destructive hover:bg-destructive/5 hover:text-destructive" 
                onClick={() => handleDelete(student.id)} 
                disabled={!isClassTeacherOfSelectedClass}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <StudentDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      <StudentDialog open={!!editingStudent} onOpenChange={(v) => !v && setEditingStudent(null)} student={editingStudent} />
      <BulkImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} />
    </div>
  );
}

function BulkImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: classes } = useListClasses();

  const downloadTemplate = () => {
    const className = classes?.[0]?.name || "Class 1";
    const csvContent = "studentIdNumber,fullName,class,gender,dateOfBirth(YYYY-MM-DD),guardianName,guardianPhone,admissionDate(YYYY-MM-DD)\n" +
      `STU001,John Doe,${className},Male,2015-05-12,Richard Doe,0240000000,2024-09-01\n` +
      `STU002,Jane Smith,${className},Female,2016-03-24,Mary Smith,0550000000,2024-09-01\n`;
      
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "students_import_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      try {
        // Robust CSV Parser (handles quotes and whitespace)
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

        // Flexible keyword-based header matching
        const getIdx = (keywords: string[]) => headers.findIndex(h => {
          const l = h.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
          return keywords.some(k => {
            const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
            return l.includes(cleanK) || cleanK.includes(l);
          });
        });

        const studentIdIdx = getIdx(["studentidnumber", "studentid", "id"]);
        const fullNameIdx = getIdx(["fullname", "name"]);
        const classIdx = getIdx(["class", "classid", "classidnumber", "classname", "class name", "class_id"]);
        const genderIdx = getIdx(["gender", "sex"]);
        const dobIdx = getIdx(["dateofbirth", "dob", "birthdate", "birth date"]);
        const guardianNameIdx = getIdx(["guardianname", "guardian"]);
        const guardianPhoneIdx = getIdx(["guardianphone", "phone", "contact"]);
        const admissionDateIdx = getIdx(["admissiondate", "admission"]);

        // Validate mandatory columns
        if (studentIdIdx === -1 || fullNameIdx === -1 || classIdx === -1) {
          toast({
            variant: "destructive",
            title: "Invalid CSV Headers",
            description: "Could not find required columns in headers. Ensure your CSV has headers for 'Student ID', 'Full Name', and 'Class'."
          });
          return;
        }

        const parsedStudents = [];

        for (let i = 1; i < lines.length; i++) {
          const cells = lines[i];
          const studentIdNumber = cells[studentIdIdx] || "";
          const fullName = cells[fullNameIdx] || "";
          const rawClassVal = classIdx !== -1 ? cells[classIdx] : "";

          // Skip completely empty rows
          if (!studentIdNumber && !fullName) continue;

          // Check required fields
          if (!studentIdNumber || !fullName || !rawClassVal) {
            toast({
              variant: "destructive",
              title: "Missing Required Fields",
              description: `Row ${i + 1}: Student ID, Full Name, and Class are required.`
            });
            return;
          }

          // Resolve Class ID from Class Name or Class ID
          let classId: number | null = null;
          const matchedClassByName = classes?.find(c => c.name.toLowerCase().trim() === rawClassVal.toLowerCase().trim());
          if (matchedClassByName) {
            classId = matchedClassByName.id;
          } else {
            const parsedId = parseInt(rawClassVal, 10);
            if (!isNaN(parsedId)) {
              const matchedClassById = classes?.find(c => c.id === parsedId);
              if (matchedClassById) {
                classId = matchedClassById.id;
              }
            }
          }

          if (classId === null) {
            toast({
              variant: "destructive",
              title: "Class Not Found",
              description: `Row ${i + 1}: Class "${rawClassVal}" was not found. Please verify the Class Name or ID.`
            });
            return;
          }

          // Normalize gender (accepts Male, M, Female, F, etc. and maps to lowercase 'male'/'female')
          let gender = null;
          if (genderIdx !== -1 && cells[genderIdx]) {
            const g = cells[genderIdx].toLowerCase().trim();
            if (g.startsWith("m")) {
              gender = "male";
            } else if (g.startsWith("f")) {
              gender = "female";
            }
          }

          // Normalize dates (convert dots or slashes to dashes)
          const normalizeDate = (dateStr: string | null | undefined): string | null => {
             if (!dateStr) return null;
             const cleaned = dateStr.trim().replace(/[\/\.]/g, "-");
             if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
               return cleaned;
             }
             return dateStr;
          };

          const dateOfBirth = dobIdx !== -1 ? normalizeDate(cells[dobIdx]) : null;
          const guardianName = guardianNameIdx !== -1 ? cells[guardianNameIdx] || null : null;
          const guardianPhone = guardianPhoneIdx !== -1 ? cells[guardianPhoneIdx] || null : null;
          const admissionDate = admissionDateIdx !== -1 ? normalizeDate(cells[admissionDateIdx]) : null;

          parsedStudents.push({
            studentIdNumber,
            fullName,
            classId,
            gender,
            dateOfBirth,
            guardianName,
            guardianPhone,
            admissionDate,
          });
        }

        if (parsedStudents.length === 0) {
          toast({ variant: "destructive", title: "Empty or invalid CSV file" });
          return;
        }

        setIsUploading(true);
        const response = await fetch("/api/students/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ students: parsedStudents }),
        });

        if (!response.ok) throw new Error(await response.text());

        const result = await response.json();
        toast({
          title: "Import completed",
          description: `Successfully imported ${result.successCount} students. Errors: ${result.errorCount}`,
        });

        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        onOpenChange(false);
      } catch (err: any) {
        toast({ variant: "destructive", title: "Import failed", description: err.message });
      } finally {
        setIsUploading(false);
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle>Import Students</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Upload a list of students in CSV format. You can specify classes using either their names or database IDs.
          </p>
          <Button type="button" variant="outline" className="w-full" onClick={downloadTemplate}>
            <Download className="w-4 h-4 mr-2" /> Download CSV Template
          </Button>
          <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer relative hover:bg-muted/30 transition-colors">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={isUploading}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Uploading students list...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm font-semibold">Click or drag CSV here</span>
                <span className="text-xs text-muted-foreground">Only .csv files supported</span>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function StudentDialog({ open, onOpenChange, student }: { open: boolean, onOpenChange: (v: boolean) => void, student?: any }) {
  const [studentIdNumber, setStudentIdNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [classId, setClassId] = useState("");
  const [gender, setGender] = useState<StudentInputGender | "">("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [admissionDate, setAdmissionDate] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");

  const { data: user } = useGetMe();
  const { data: classes } = useListClasses();
  const allowedClasses = classes?.filter(cls => {
    if (user?.role === "admin") return true;
    if (user?.role === "teacher") return cls.classTeacherId === user.teacherId;
    return false;
  }) || [];

  const create = useCreateStudent();
  const update = useUpdateStudent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  React.useEffect(() => {
    if (open) {
      setStudentIdNumber(student?.studentIdNumber || "");
      setFullName(student?.fullName || "");
      setGender(student?.gender || "");
      setDateOfBirth(student?.dateOfBirth?.split("T")[0] || "");
      setAdmissionDate(student?.admissionDate?.split("T")[0] || "");
      setGuardianName(student?.guardianName || "");
      setGuardianPhone(student?.guardianPhone || "");
      
      if (student?.classId) {
        setClassId(student.classId.toString());
      } else if (user?.role === "teacher") {
        const ledClass = classes?.find(cls => cls.classTeacherId === user.teacherId);
        if (ledClass) setClassId(ledClass.id.toString());
      } else {
        setClassId("");
      }
    }
  }, [open, student, user, classes]);

  const isEditing = !!student;

  const handleSave = () => {
    if (!studentIdNumber || !fullName || !classId) {
      return toast({ variant: "destructive", title: "Fill all required fields" });
    }
    const payload: any = {
      studentIdNumber, fullName, classId: parseInt(classId),
      gender: gender || undefined, dateOfBirth: dateOfBirth || undefined,
      admissionDate: admissionDate || undefined,
      guardianName: guardianName || undefined, guardianPhone: guardianPhone || undefined
    };
    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
      toast({ title: isEditing ? "Updated" : "Created" });
      onOpenChange(false);
    };
    if (isEditing) {
      update.mutate({ id: student.id, data: payload }, { onSuccess });
    } else {
      create.mutate({ data: payload }, { onSuccess });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-xl mx-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Student" : "Register Student"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Student ID Number *</Label>
              <Input value={studentIdNumber} onChange={e => setStudentIdNumber(e.target.value)} disabled={isEditing} placeholder="e.g. STU-2024-001" />
            </div>
            <div className="space-y-2">
              <Label>Class *</Label>
              <Select value={classId} onChange={e => setClassId(e.target.value)}>
                <option value="">Select class...</option>
                {allowedClasses.map(c => <option key={c.id} value={c.id.toString()}>{c.name}</option>)}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={gender} onChange={e => setGender(e.target.value as any)}>
                <option value="">Not specified</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <Input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Guardian Name</Label>
              <Input value={guardianName} onChange={e => setGuardianName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Guardian Phone</Label>
              <Input value={guardianPhone} onChange={e => setGuardianPhone(e.target.value)} />
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
