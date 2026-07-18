import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import type { Student } from "@workspace/api-client-react";

interface StudentMobileListProps {
  students: Student[];
  isClassTeacherOfSelectedClass: boolean;
  onEdit: (student: Student) => void;
  onDelete: (id: number) => void;
}

export const StudentMobileList = React.memo(({
  students,
  isClassTeacherOfSelectedClass,
  onEdit,
  onDelete,
}: StudentMobileListProps) => {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:hidden">
      {students.length === 0 && (
        <div className="text-center text-muted-foreground py-10 border border-dashed rounded-xl bg-card/20">
          No students found.
        </div>
      )}
      {students.map((student) => (
        <StudentMobileRow
          key={student.id}
          student={student}
          isClassTeacherOfSelectedClass={isClassTeacherOfSelectedClass}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
});

StudentMobileList.displayName = "StudentMobileList";

interface StudentMobileRowProps {
  student: Student;
  isClassTeacherOfSelectedClass: boolean;
  onEdit: (student: Student) => void;
  onDelete: (id: number) => void;
}

const StudentMobileRow = React.memo(({
  student,
  isClassTeacherOfSelectedClass,
  onEdit,
  onDelete,
}: StudentMobileRowProps) => {
  return (
    <div className="border border-border/50 bg-card/30 px-3 py-2.5 rounded-lg flex items-center justify-between gap-3 shadow-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm text-foreground truncate">{student.fullName}</h3>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 leading-none shrink-0">
            {student.className}
          </Badge>
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
          onClick={() => onEdit(student)}
          disabled={!isClassTeacherOfSelectedClass}
          aria-label={`Edit ${student.fullName}`}
        >
          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 rounded-full text-destructive hover:bg-destructive/5 hover:text-destructive"
          onClick={() => onDelete(student.id)}
          disabled={!isClassTeacherOfSelectedClass}
          aria-label={`Delete ${student.fullName}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
});

StudentMobileRow.displayName = "StudentMobileRow";
