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

  // 5. Insert Classes
  console.log("Seeding classes...");
  const classesToSeed = [
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
    console.log(`Class ${c.name} created. Class Teacher ID: ${classTeacherId}`);
  }

  // 6. Seed Subjects
  console.log("Seeding standard GES subjects...");
  const subjectsToSeed = [
    { name: "Mathematics", code: "MATH101" },
    { name: "English Language", code: "ENG101" },
    { name: "Integrated Science", code: "SCI101" },
    { name: "Social Studies", code: "SOC101" },
    { name: "Information and Communication Technology (ICT)", code: "ICT101" },
    { name: "Religious and Moral Education (RME)", code: "RME101" },
    { name: "Career Technology", code: "CAR101" },
    { name: "Creative Arts and Design", code: "CAD101" },
    { name: "Ghanaian Language (Twi)", code: "GHA101" },
    { name: "French", code: "FRE101" }
  ];

  const subjectIdMap: Record<string, number> = {};
  for (const s of subjectsToSeed) {
    const [insertedSubj] = await db.insert(subjectsTable).values(s).returning();
    subjectIdMap[s.name] = insertedSubj.id;
    console.log(`Subject created: ${s.name} (${s.code})`);
  }

  // 7. Seed Class Subjects, Teacher Assignments, and Assessment Components
  console.log("Assigning subjects to classes and scheduling teachers...");
  
  // Teachers teaching schedule:
  // All mapped to the single teacher: Regular Teacher (demo)
  const teacherSubjectMap: Record<string, string> = {
    "Mathematics": "teacher@school.gh",
    "Information and Communication Technology (ICT)": "teacher@school.gh",
    "English Language": "teacher@school.gh",
    "French": "teacher@school.gh",
    "Integrated Science": "teacher@school.gh",
    "Career Technology": "teacher@school.gh",
    "Social Studies": "teacher@school.gh",
    "Religious and Moral Education (RME)": "teacher@school.gh",
    "Ghanaian Language (Twi)": "teacher@school.gh",
    "Creative Arts and Design": "teacher@school.gh"
  };

  // Keep track of assessment components for each class subject
  // format: { [classSubjectId]: [ { id, name, maxScore, weightPercent } ] }
  const classSubjectComponentsMap: Record<number, Array<{ id: number; name: string; maxScore: number; weightPercent: number }>> = {};

  for (const className of ["JHS 1", "JHS 2", "JHS 3"]) {
    const classId = classIdMap[className];
    
    for (const subjName of Object.keys(subjectIdMap)) {
      const subjectId = subjectIdMap[subjName];
      
      // Class Subject mapping
      const [classSubj] = await db.insert(classSubjectsTable).values({
        classId: classId,
        subjectId: subjectId
      }).returning();
      
      console.log(`Linked subject ${subjName} to class ${className}`);

      // Teacher Assignment mapping
      const teacherEmail = teacherSubjectMap[subjName];
      const assignedTeacherId = teacherIdMap[teacherEmail];
      if (assignedTeacherId) {
        await db.insert(teacherAssignmentsTable).values({
          teacherId: assignedTeacherId,
          classSubjectId: classSubj.id,
          termId: termId
        });
        console.log(`Assigned ${teacherEmail} to teach ${subjName} in ${className}`);
      }

      // Assessment Components mapping (Total 100%)
      const comps = [
        { name: "Class Exercise", maxScore: 20.00, weightPercent: 10.00 },
        { name: "Group Work", maxScore: 30.00, weightPercent: 10.00 },
        { name: "Class Test", maxScore: 50.00, weightPercent: 10.00 },
        { name: "Exam", maxScore: 100.00, weightPercent: 70.00 }
      ];

      const insertedComps = [];
      for (const comp of comps) {
        const [insertedComp] = await db.insert(assessmentComponentsTable).values({
          classSubjectId: classSubj.id,
          termId: termId,
          name: comp.name,
          maxScore: comp.maxScore,
          weightPercent: comp.weightPercent
        }).returning();
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
  console.log("Seeding students in JHS 1, JHS 2, JHS 3...");
  const studentsToSeed = [
    // JHS 1
    { studentIdNumber: "STU001", fullName: "Kofi Mensah", dateOfBirth: "2013-05-12", gender: "Male", className: "JHS 1", guardianName: "Ekow Mensah", guardianPhone: "0244111222" },
    { studentIdNumber: "STU002", fullName: "Ama Serwaa", dateOfBirth: "2014-02-20", gender: "Female", className: "JHS 1", guardianName: "Grace Serwaa", guardianPhone: "0244333444" },
    { studentIdNumber: "STU003", fullName: "Kwadwo Asare", dateOfBirth: "2013-11-05", gender: "Male", className: "JHS 1", guardianName: "Samuel Asare", guardianPhone: "0244555666" },
    { studentIdNumber: "STU004", fullName: "Abena Osei", dateOfBirth: "2014-07-30", gender: "Female", className: "JHS 1", guardianName: "Mary Osei", guardianPhone: "0244777888" },
    { studentIdNumber: "STU005", fullName: "Yaw Boateng", dateOfBirth: "2013-04-15", gender: "Male", className: "JHS 1", guardianName: "Joseph Boateng", guardianPhone: "0244888999" },
    { studentIdNumber: "STU006", fullName: "Yaa Pokuaa", dateOfBirth: "2013-09-08", gender: "Female", className: "JHS 1", guardianName: "Mercy Pokuaa", guardianPhone: "0244999000" },
    { studentIdNumber: "STU007", fullName: "Kwaku Addo", dateOfBirth: "2014-01-11", gender: "Male", className: "JHS 1", guardianName: "Daniel Addo", guardianPhone: "0244222111" },
    { studentIdNumber: "STU008", fullName: "Akua Afriyie", dateOfBirth: "2013-12-25", gender: "Female", className: "JHS 1", guardianName: "Gladys Afriyie", guardianPhone: "0244555444" },

    // JHS 2
    { studentIdNumber: "STU009", fullName: "Kwame Nkrumah", dateOfBirth: "2012-09-21", gender: "Male", className: "JHS 2", guardianName: "Elizabeth Nkrumah", guardianPhone: "0544111222" },
    { studentIdNumber: "STU010", fullName: "Efua Sutherland", dateOfBirth: "2012-06-27", gender: "Female", className: "JHS 2", guardianName: "Kofi Sutherland", guardianPhone: "0544333444" },
    { studentIdNumber: "STU011", fullName: "Kojo Antwi", dateOfBirth: "2012-10-15", gender: "Male", className: "JHS 2", guardianName: "Mawusi Antwi", guardianPhone: "0544555666" },
    { studentIdNumber: "STU012", fullName: "Esi Edugyan", dateOfBirth: "2013-02-18", gender: "Female", className: "JHS 2", guardianName: "Ekow Edugyan", guardianPhone: "0544777888" },
    { studentIdNumber: "STU013", fullName: "Kwabena Yeboah", dateOfBirth: "2012-12-04", gender: "Male", className: "JHS 2", guardianName: "Comfort Yeboah", guardianPhone: "0544888999" },
    { studentIdNumber: "STU014", fullName: "Adwoa Safo", dateOfBirth: "2012-07-19", gender: "Female", className: "JHS 2", guardianName: "Thomas Safo", guardianPhone: "0544999000" },
    { studentIdNumber: "STU015", fullName: "Kofi Annan", dateOfBirth: "2012-04-08", gender: "Male", className: "JHS 2", guardianName: "Ama Annan", guardianPhone: "0544222111" },
    { studentIdNumber: "STU016", fullName: "Akosua Agyapong", dateOfBirth: "2012-11-30", gender: "Female", className: "JHS 2", guardianName: "Isaac Agyapong", guardianPhone: "0544555444" },

    // JHS 3
    { studentIdNumber: "STU017", fullName: "Samuel Kuffour", dateOfBirth: "2011-09-03", gender: "Male", className: "JHS 3", guardianName: "Theresa Kuffour", guardianPhone: "0204111222" },
    { studentIdNumber: "STU018", fullName: "Alberta Ampomah", dateOfBirth: "2011-12-14", gender: "Female", className: "JHS 3", guardianName: "Kwame Ampomah", guardianPhone: "0204333444" },
    { studentIdNumber: "STU019", fullName: "Stephen Appiah", dateOfBirth: "2011-12-24", gender: "Male", className: "JHS 3", guardianName: "Rebecca Appiah", guardianPhone: "0204555666" },
    { studentIdNumber: "STU020", fullName: "Gifty Anti", dateOfBirth: "2012-01-23", gender: "Female", className: "JHS 3", guardianName: "George Anti", guardianPhone: "0204777888" },
    { studentIdNumber: "STU021", fullName: "Michael Essien", dateOfBirth: "2011-12-03", gender: "Male", className: "JHS 3", guardianName: "Theresa Essien", guardianPhone: "0204888999" },
    { studentIdNumber: "STU022", fullName: "Lydia Forson", dateOfBirth: "2011-10-24", gender: "Female", className: "JHS 3", guardianName: "Francis Forson", guardianPhone: "0204999000" },
    { studentIdNumber: "STU023", fullName: "Asamoah Gyan", dateOfBirth: "2011-11-22", gender: "Male", className: "JHS 3", guardianName: "Cecilia Gyan", guardianPhone: "0204222111" },
    { studentIdNumber: "STU024", fullName: "Naa Ashorkor", dateOfBirth: "2011-10-16", gender: "Female", className: "JHS 3", guardianName: "Isaac Ashorkor", guardianPhone: "0204555444" }
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

  // 9. Seeding Scores (Simulation logic)
  console.log("Seeding simulated grades and scores...");
  
  // Deterministic score generator to make simulation look realistic and consistent
  const getSimulatedScore = (studentId: number, componentId: number, maxScore: number) => {
    const seed = (studentId * 13 + componentId * 29) % 100;
    // Map to 65% - 97% range (nice grades from B3 to A1)
    const percent = 65 + (seed % 33);
    return Math.round((percent / 100) * maxScore * 10) / 10;
  };

  // Retrieve class subject mappings
  const classSubjects = await db.select().from(classSubjectsTable);

  for (const cs of classSubjects) {
    const classObj = await db.select().from(classesTable).where(eq(classesTable.id, cs.classId));
    const className = classObj[0]?.name;
    const subjectObj = await db.select().from(subjectsTable).where(eq(subjectsTable.id, cs.subjectId));
    const subjectName = subjectObj[0]?.name;
    const teacherEmail = teacherSubjectMap[subjectName];
    const teacherId = teacherIdMap[teacherEmail];
    
    // Class Subjects Components
    const components = classSubjectComponentsMap[cs.id] || [];

    // Get students in this class
    const studentsInClass = seededStudents.filter(s => s.classId === cs.classId);

    // Simulation Scenario:
    // - JHS 1: 100% of scores are seeded (fully completed grading)
    // - JHS 2: 50% of the subjects are graded, others left blank (in-progress)
    // - JHS 3: 0% of subjects are graded (completely empty, fresh for manual entry)
    let shouldSeedScores = false;
    if (className === "JHS 1") {
      shouldSeedScores = true;
    } else if (className === "JHS 2") {
      // Seed scores for only these 5 subjects
      const gradedSubjects = [
        "Mathematics", 
        "English Language", 
        "Integrated Science", 
        "Social Studies", 
        "Information and Communication Technology (ICT)"
      ];
      shouldSeedScores = gradedSubjects.includes(subjectName);
    }

    if (shouldSeedScores) {
      console.log(`Seeding scores for ${className} - ${subjectName}...`);
      for (const student of studentsInClass) {
        for (const comp of components) {
          const scoreVal = getSimulatedScore(student.id, comp.id, comp.maxScore);
          await db.insert(scoresTable).values({
            studentId: student.id,
            assessmentComponentId: comp.id,
            teacherId: teacherId,
            scoreValue: scoreVal,
            isLocked: className === "JHS 1" // Lock JHS 1 scores
          });
        }
      }
    }
  }

  // 10. Seeding Grading Scale
  console.log("Seeding grading scale...");
  await db.insert(gradingScaleTable).values([
    { minScore: 80.00, maxScore: 100.00, gradeLabel: "A1", remark: "Excellent" },
    { minScore: 75.00, maxScore: 79.99, gradeLabel: "B2", remark: "Very Good" },
    { minScore: 70.00, maxScore: 74.99, gradeLabel: "B3", remark: "Good" },
    { minScore: 65.00, maxScore: 69.99, gradeLabel: "C4", remark: "Credit" },
    { minScore: 60.00, maxScore: 64.99, gradeLabel: "C5", remark: "Credit" },
    { minScore: 55.00, maxScore: 59.99, gradeLabel: "C6", remark: "Credit" },
    { minScore: 50.00, maxScore: 54.99, gradeLabel: "D7", remark: "Pass" },
    { minScore: 40.00, maxScore: 49.99, gradeLabel: "E8", remark: "Pass" },
    { minScore: 0.00, maxScore: 39.99, gradeLabel: "F9", remark: "Fail" },
  ]);

  // 11. Seeding Report Card Status
  console.log("Seeding report card status...");
  // JHS 1: submitted (since scores are 100% entered and locked)
  // JHS 2: draft (scores in progress)
  // JHS 3: draft (scores not entered yet)
  const systemAdminUser = seededUsers.find(u => u.email === "admin@school.gh");
  
  await db.insert(reportCardStatusTable).values([
    {
      classId: classIdMap["JHS 1"],
      termId: termId,
      status: "submitted" as const
    },
    {
      classId: classIdMap["JHS 2"],
      termId: termId,
      status: "draft" as const
    },
    {
      classId: classIdMap["JHS 3"],
      termId: termId,
      status: "draft" as const
    }
  ]);

  console.log("Database seeding & school simulation completed successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
