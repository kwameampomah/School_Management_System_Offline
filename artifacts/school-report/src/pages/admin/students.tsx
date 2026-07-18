import React, { useState } from "react";
import { useListStudents, useDeleteStudent, useListClasses, useGetMe, useListTeacherAssignments } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListStudentsQueryKey, Student } from "@workspace/api-client-react";
import { Loader2, Plus, Upload } from "lucide-react";
import { StudentTable } from "@/components/StudentTable";
import { StudentMobileList } from "@/components/StudentMobileList";
import { StudentDialog } from "@/components/StudentDialog";
import { BulkImportDialog } from "@/components/BulkImportDialog";

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
      const selectedCls = classes?.find(cls => cls.id === parseInt(classFilter, 10));
      return selectedCls?.classTeacherId === user.teacherId;
    }
    return false;
  }, [user, classes, classFilter]);

  const { data: students, isLoading } = useListStudents(classFilter ? { classId: parseInt(classFilter, 10) } : undefined);

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
    const list = [...filteredStudents];
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
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
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
            <p className="text-muted-foreground text-sm hidden sm:block font-normal">Manage student enrollments and class allocations.</p>
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
        <StudentTable
          students={sortedStudents}
          isClassTeacherOfSelectedClass={isClassTeacherOfSelectedClass}
          onEdit={setEditingStudent}
          onDelete={handleDelete}
        />
      </Card>

      {/* Mobile Version: Responsive Card Grid */}
      <StudentMobileList
        students={sortedStudents}
        isClassTeacherOfSelectedClass={isClassTeacherOfSelectedClass}
        onEdit={setEditingStudent}
        onDelete={handleDelete}
      />

      <StudentDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      <StudentDialog open={!!editingStudent} onOpenChange={(v) => !v && setEditingStudent(null)} student={editingStudent} />
      <BulkImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} />
    </div>
  );
}
