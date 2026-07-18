import React, { useState } from "react";
import { useListClasses, getListStudentsQueryKey, StudentInputGender } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload, Download } from "lucide-react";

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedStudentRow {
  studentIdNumber: string;
  fullName: string;
  classId: number;
  gender: StudentInputGender | null;
  dateOfBirth: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  admissionDate: string | null;
}

export const BulkImportDialog = ({ open, onOpenChange }: BulkImportDialogProps) => {
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
          const result: string[] = [];
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

        const parsedStudents: ParsedStudentRow[] = [];

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
          let gender: StudentInputGender | null = null;
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
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Import failed";
        toast({ variant: "destructive", title: "Import failed", description: errMsg });
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
};
