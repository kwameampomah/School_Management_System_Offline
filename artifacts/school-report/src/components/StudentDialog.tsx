import React, { useState, useEffect } from "react";
import { useCreateStudent, useUpdateStudent, useListClasses, useGetMe, getListStudentsQueryKey, StudentInputGender } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { Student } from "@workspace/api-client-react";

interface StudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student?: Student | null;
}

export const StudentDialog = ({ open, onOpenChange, student }: StudentDialogProps) => {
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

  useEffect(() => {
    if (open) {
      setStudentIdNumber(student?.studentIdNumber || "");
      setFullName(student?.fullName || "");
      setGender(student?.gender as StudentInputGender || "");
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

    const payload = {
      studentIdNumber,
      fullName,
      classId: parseInt(classId, 10),
      gender: gender ? (gender as StudentInputGender) : undefined,
      dateOfBirth: dateOfBirth || undefined,
      admissionDate: admissionDate || undefined,
      guardianName: guardianName || undefined,
      guardianPhone: guardianPhone || undefined
    };

    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
      toast({ title: isEditing ? "Updated successfully" : "Created successfully" });
      onOpenChange(false);
    };

    if (isEditing && student) {
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
              <Label htmlFor="student-id-input">Student ID Number *</Label>
              <Input id="student-id-input" value={studentIdNumber} onChange={e => setStudentIdNumber(e.target.value)} disabled={isEditing} placeholder="e.g. STU-2024-001" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class-select">Class *</Label>
              <Select id="class-select" value={classId} onChange={e => setClassId(e.target.value)}>
                <option value="">Select class...</option>
                {allowedClasses.map(c => <option key={c.id} value={c.id.toString()}>{c.name}</option>)}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name-input">Full Name *</Label>
            <Input id="name-input" value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gender-select">Gender</Label>
              <Select id="gender-select" value={gender} onChange={e => setGender(e.target.value as StudentInputGender | "")}>
                <option value="">Not specified</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob-input">Date of Birth</Label>
              <Input id="dob-input" type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="guardian-name-input">Guardian Name</Label>
              <Input id="guardian-name-input" value={guardianName} onChange={e => setGuardianName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guardian-phone-input">Guardian Phone</Label>
              <Input id="guardian-phone-input" value={guardianPhone} onChange={e => setGuardianPhone(e.target.value)} />
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
};
