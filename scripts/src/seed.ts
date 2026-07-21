import { 
  db, 
  usersTable, 
  teachersTable, 
  academicYearsTable, 
  termsTable, 
  classesTable, 
  subjectsTable, 
  classSubjectsTable, 
  teacherAssignmentsTable, 
  studentsTable, 
  assessmentComponentsTable, 
  gradingScaleTable, 
  reportCardStatusTable,
  scoresTable
} from "@workspace/db";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";

async function main() {
  console.log("Cleaning up existing database tables to prepare for clean simulation...");
  // Delete in dependency-safe order
  await db.delete(reportCardStatusTable);
  await db.delete(scoresTable);
  await db.delete(assessmentComponentsTable);
  await db.delete(teacherAssignmentsTable);
  await db.delete(studentsTable);
  await db.delete(classSubjectsTable);
  await db.delete(classesTable);
  await db.delete(teachersTable);
  await db.delete(usersTable);
  await db.delete(subjectsTable);
  await db.delete(termsTable);
  await db.delete(academicYearsTable);
  await db.delete(gradingScaleTable);
  console.log("Cleanup finished.");

  console.log("Starting database seeding for simulated school...");

  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  const teacherPasswordHash = await bcrypt.hash("teacher123", 10);
  
  // 1. Insert Users (Admin + Teachers)
  console.log("Seeding admin and teacher users...");
  
  const teachersData = [
    { fullName: "System Admin", email: "admin@school.gh", role: "admin" as const, passwordHash: adminPasswordHash },
    { fullName: "Regular Teacher", email: "teacher@school.gh", role: "teacher" as const, passwordHash: teacherPasswordHash }
  ];

  const seededUsers = [];
  for (const u of teachersData) {
    const [inserted] = await db.insert(usersTable).values({
      fullName: u.fullName,
      email: u.email,
      passwordHash: u.passwordHash,
      role: u.role
    }).returning();
    seededUsers.push(inserted);
    console.log(`Created user: ${u.fullName} (${u.role})`);
  }

  // 2. Insert Teacher Profiles
  console.log("Seeding teacher profiles...");
  const teacherIdMap: Record<string, number> = {};
  
  const staffProfiles = [
    { email: "teacher@school.gh", staffId: "T1001", phone: "0555111222" }
  ];

  for (const profile of staffProfiles) {
    const user = seededUsers.find(u => u.email === profile.email);
    if (user) {
      const [insertedTeacher] = await db.insert(teachersTable).values({
        userId: user.id,
        staffId: profile.staffId,
        phone: profile.phone
      }).returning();
      teacherIdMap[profile.email] = insertedTeacher.id;
      console.log(`Teacher profile created for ${user.fullName} with Staff ID: ${profile.staffId}`);
    }
  }

  // 3. Insert Academic Year
  console.log("Seeding academic year...");
  const [academicYear] = await db.insert(academicYearsTable).values({
    yearLabel: "2025/2026",
    isCurrent: true,
  }).returning();
  const academicYearId = academicYear.id;

  // 4. Insert Term
  console.log("Seeding term...");
  const [term] = await db.insert(termsTable).values({
    academicYearId: academicYearId,
    name: "Term 1",
    startDate: "2025-09-01",
    endDate: "2025-12-15",
    isCurrent: true,
  }).returning();
  const termId = term.id;

  // 5. Insert Classes (Primary & JHS)
  console.log("Seeding Primary and JHS classes...");
  const classesToSeed = [
    { name: "Nursery", teacherEmail: "teacher@school.gh" },
    { name: "KG 1", teacherEmail: "teacher@school.gh" },
    { name: "KG 2", teacherEmail: "teacher@school.gh" },
    { name: "Basic 1", teacherEmail: "teacher@school.gh" },
    { name: "Basic 2", teacherEmail: "teacher@school.gh" },
    { name: "Basic 3", teacherEmail: "teacher@school.gh" },
    { name: "Basic 4", teacherEmail: "teacher@school.gh" },
    { name: "Basic 5", teacherEmail: "teacher@school.gh" },
    { name: "Basic 6", teacherEmail: "teacher@school.gh" },
    { name: "JHS 1", teacherEmail: "teacher@school.gh" },
    { name: "JHS 2", teacherEmail: "teacher@school.gh" },
    { name: "JHS 3", teacherEmail: "teacher@school.gh" }
  ];

  const classIdMap: Record<string, number> = {};
  for (const c of classesToSeed) {
    const classTeacherId = teacherIdMap[c.teacherEmail];
    const [insertedClass] = await db.insert(classesTable).values({
      name: c.name,
      academicYearId: academicYearId,
      classTeacherId: classTeacherId
    }).returning();
    classIdMap[c.name] = insertedClass.id;
    console.log(`Class ${c.name} created.`);
  }

  // 6. Seed Subjects (Both JHS & Primary)
  console.log("Seeding standard GES Primary and JHS subjects...");
  const subjectsToSeed = [
    // --- JHS Subjects ---
    { name: "Mathematics", code: "MATH101" },
    { name: "English Language", code: "ENG101" },
    { name: "Integrated Science", code: "SCI101" },
    { name: "Social Studies", code: "SOC101" },
    { name: "Information and Communication Technology (ICT)", code: "ICT101" },
    { name: "Religious and Moral Education (RME)", code: "RME101" },
    { name: "Career Technology", code: "CAR101" },
    { name: "Creative Arts and Design", code: "CAD101" },
    { name: "Ghanaian Language (Twi)", code: "GHA101" },
    { name: "French", code: "FRE101" },

    // --- Primary Subjects ---
    { name: "Literacy (English Language)", code: "ENG_PRI" },
    { name: "Numeracy (Mathematics)", code: "MATH_PRI" },
    { name: "Science", code: "SCI_PRI" },
    { name: "Religious and Moral Education (Primary)", code: "RME_PRI" },
    { name: "History", code: "HIST_PRI" },
    { name: "French (Primary)", code: "FRE_PRI" },
    { name: "Literacy (Asante Twi)", code: "TWI_PRI" },
    { name: "Creative Arts", code: "ART_PRI" },
    { name: "Writing", code: "WRIT_PRI" },
    { name: "Physical Education", code: "PE_PRI" },
    { name: "Computing", code: "COMP_PRI" }
  ];

  const subjectIdMap: Record<string, number> = {};
  for (const s of subjectsToSeed) {
    const [insertedSubj] = await db.insert(subjectsTable).values(s).returning();
    subjectIdMap[s.name] = insertedSubj.id;
    console.log(`Subject created: ${s.name} (${s.code})`);
  }

  // 7. Seed Class Subjects, Teacher Assignments, and Assessment Components
  console.log("Assigning subjects to classes...");

  const jhsSubjectNames = [
    "Mathematics", "English Language", "Integrated Science", "Social Studies",
    "Information and Communication Technology (ICT)", "Religious and Moral Education (RME)",
    "Career Technology", "Creative Arts and Design", "Ghanaian Language (Twi)", "French"
  ];

  const primarySubjectNames = [
    "Literacy (English Language)", "Numeracy (Mathematics)", "Science",
    "Religious and Moral Education (Primary)", "History", "French (Primary)",
    "Literacy (Asante Twi)", "Creative Arts", "Writing", "Physical Education", "Computing"
  ];

  const classSubjectComponentsMap: Record<number, Array<{ id: number; name: string; maxScore: number; weightPercent: number }>> = {};

  for (const className of Object.keys(classIdMap)) {
    const classId = classIdMap[className];
    const isJHS = className.startsWith("JHS");
    const activeSubjectNames = isJHS ? jhsSubjectNames : primarySubjectNames;

    for (const subjName of activeSubjectNames) {
      const subjectId = subjectIdMap[subjName];
      if (!subjectId) continue;

      const [classSubj] = await db.insert(classSubjectsTable).values({
        classId: classId,
        subjectId: subjectId
      }).returning();

      const assignedTeacherId = teacherIdMap["teacher@school.gh"];
      if (assignedTeacherId) {
        await db.insert(teacherAssignmentsTable).values({
          teacherId: assignedTeacherId,
          classSubjectId: classSubj.id,
          termId: termId
        });
      }

      // Assessment Components mapping (Total 100%)
      const comps = [
        { name: "Class Work (50%)", maxScore: 100.00, weightPercent: 50.00 },
        { name: "Exam (50%)", maxScore: 100.00, weightPercent: 50.00 }
      ];

      const insertedComps = [];
      for (const comp of comps) {
        const [insertedComp] = await db.insert(assessmentComponentsTable).values({
          classSubjectId: classSubj.id,
          termId: termId,
          name: comp.name,
          maxScore: comp.maxScore,
          weightPercent: comp.weightPercent
        } as any).returning();
        insertedComps.push({
          id: insertedComp.id,
          name: insertedComp.name,
          maxScore: comp.maxScore,
          weightPercent: comp.weightPercent
        });
      }
      classSubjectComponentsMap[classSubj.id] = insertedComps;
    }
  }

  // 8. Seeding Students
  console.log("Seeding sample students...");
  const studentsToSeed = [
    // JHS 1
    { studentIdNumber: "STU001", fullName: "Kofi Mensah", dateOfBirth: "2013-05-12", gender: "Male", className: "JHS 1", guardianName: "Ekow Mensah", guardianPhone: "0244111222" },
    { studentIdNumber: "STU002", fullName: "Ama Serwaa", dateOfBirth: "2014-02-20", gender: "Female", className: "JHS 1", guardianName: "Grace Serwaa", guardianPhone: "0244333444" },
    { studentIdNumber: "STU003", fullName: "Kwadwo Asare", dateOfBirth: "2013-11-05", gender: "Male", className: "JHS 1", guardianName: "Samuel Asare", guardianPhone: "0244555666" },
    { studentIdNumber: "STU004", fullName: "Abena Osei", dateOfBirth: "2014-07-30", gender: "Female", className: "JHS 1", guardianName: "Mary Osei", guardianPhone: "0244777888" },

    // Basic 1
    { studentIdNumber: "STU005", fullName: "Yaw Boateng", dateOfBirth: "2018-04-15", gender: "Male", className: "Basic 1", guardianName: "Joseph Boateng", guardianPhone: "0244888999" },
    { studentIdNumber: "STU006", fullName: "Yaa Pokuaa", dateOfBirth: "2018-09-08", gender: "Female", className: "Basic 1", guardianName: "Mercy Pokuaa", guardianPhone: "0244999000" }
  ];

  const seededStudents = [];
  for (const s of studentsToSeed) {
    const classId = classIdMap[s.className];
    const [insertedStud] = await db.insert(studentsTable).values({
      studentIdNumber: s.studentIdNumber,
      fullName: s.fullName,
      dateOfBirth: s.dateOfBirth,
      gender: s.gender,
      classId: classId,
      guardianName: s.guardianName,
      guardianPhone: s.guardianPhone,
      admissionDate: "2024-09-01"
    }).returning();
    seededStudents.push(insertedStud);
    console.log(`Student created: ${s.fullName} in ${s.className}`);
  }

  // 9. Seeding Grading Scale
  console.log("Seeding grading scale...");
  const scales = [
    { minScore: "80.00", maxScore: "100.00", gradeLabel: "A1", remark: "Highest / Superior" },
    { minScore: "75.00", maxScore: "79.99", gradeLabel: "B2", remark: "Higher" },
    { minScore: "70.00", maxScore: "74.99", gradeLabel: "B3", remark: "Good" },
    { minScore: "65.00", maxScore: "69.99", gradeLabel: "C4", remark: "High Average" },
    { minScore: "60.00", maxScore: "64.99", gradeLabel: "C5", remark: "Average" },
    { minScore: "55.00", maxScore: "59.99", gradeLabel: "C6", remark: "Low Average" },
    { minScore: "50.00", maxScore: "54.99", gradeLabel: "D7", remark: "Low" },
    { minScore: "40.00", maxScore: "49.99", gradeLabel: "E8", remark: "Pass" },
    { minScore: "0.00", maxScore: "39.99", gradeLabel: "F9", remark: "Lowest" },
  ];

  for (const scale of scales) {
    await db.insert(gradingScaleTable).values(scale as any);
  }

  console.log("Database seeding completed successfully! Added all Primary & JHS subjects and classes.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
