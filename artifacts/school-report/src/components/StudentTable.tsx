import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import type { Student } from "@workspace/api-client-react";

interface StudentTableProps {
  students: Student[];
  isClassTeacherOfSelectedClass: boolean;
  onEdit: (student: Student) => void;
  onDelete: (id: number) => void;
}

export const StudentTable = React.memo(({
  students,
  isClassTeacherOfSelectedClass,
  onEdit,
  onDelete,
}: StudentTableProps) => {
  return (
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
        {students.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
              No students found.
            </TableCell>
          </TableRow>
        )}
        {students.map((student) => (
          <StudentRow
            key={student.id}
            student={student}
            isClassTeacherOfSelectedClass={isClassTeacherOfSelectedClass}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </TableBody>
    </Table>
  );
});

StudentTable.displayName = "StudentTable";

interface StudentRowProps {
  student: Student;
  isClassTeacherOfSelectedClass: boolean;
  onEdit: (student: Student) => void;
  onDelete: (id: number) => void;
}

const StudentRow = React.memo(({
  student,
  isClassTeacherOfSelectedClass,
  onEdit,
  onDelete,
}: StudentRowProps) => {
  return (
    <TableRow>
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(student)}
            disabled={!isClassTeacherOfSelectedClass}
            aria-label={`Edit ${student.fullName}`}
          >
            <Pencil className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(student.id)}
            disabled={!isClassTeacherOfSelectedClass}
            aria-label={`Delete ${student.fullName}`}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

StudentRow.displayName = "StudentRow";
