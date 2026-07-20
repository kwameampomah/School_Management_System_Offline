import { StudentReportCard } from "@workspace/api-client-react";

export default function StudentReportCardView({ reportCard }: { reportCard: StudentReportCard }) {
  if (!reportCard) return null;

  const isPrimary = !(reportCard.className || "").toLowerCase().includes("jhs");
  const overallTotal = reportCard.subjectResults?.reduce((acc, s) => acc + s.total, 0) || 0;

  // SBC Primary grading legend rules
  const sbcLegend = [
    { range: "100 - 80", grade: "A", remark: "ADVANCE", desc: "Learner exceeds core requirement in terms of knowledge, skills and understanding and can transfer them automatically and flexibly trough authentic performance tasks" },
    { range: "79 - 68", grade: "P", remark: "PROFICIENCY", desc: "Learner develops fundamental knowledge, skills and core understanding and transfers them independently through authentic performance tasks" },
    { range: "67 - 54", grade: "AP", remark: "APPROACHING PROFICIENCY", desc: "Learner develops fundamental knowledge, skills and core understanding; with little guidance; can transfer understanding through authentic performance task" },
    { range: "53 - 40", grade: "D", remark: "DEVELOPING", desc: "Learner possesses the minimum knowledge and skills but needs, help throughout the performance of authentic tasks." },
    { range: "39 - Below", grade: "B", remark: "BEGINNING", desc: "Learner is struggling with his/her understanding due to lack of essential knowledge and skills." },
  ];

  // Default Primary subjects list
  const primarySubjectsList = [
    "LITERACY (ENGLISH LANGUAGE)",
    "NUMERACY (MATHEMATICS)",
    "SCIENCE",
    "RELIGIOUS AND MORAL EDUCATION",
    "HISTORY",
    "FRENCH",
    "LITERACY (ASANTE TWI)",
    "CREATIVE ARTS",
    "WRITING",
    "PHYSICAL EDUCATION",
    "COMPUTING",
  ];

  // Map results or fallbacks
  const displaySubjects = isPrimary
    ? primarySubjectsList.map(name => {
        const match = reportCard.subjectResults?.find(s => s.subjectName.toUpperCase().trim() === name || name.includes(s.subjectName.toUpperCase().trim()));
        return {
          name,
          classWork50: match ? Math.round(match.total * 0.5) : 0,
          exam50: match ? Math.round(match.total * 0.5) : 0,
          total100: match ? match.total : 0,
          grade: match?.grade || "B",
          remark: match?.remark || "BEGINNING",
        };
      })
    : (reportCard.subjectResults || []).map(s => ({
        name: s.subjectName.toUpperCase(),
        classWork50: Math.round(s.total * 0.5),
        exam50: Math.round(s.total * 0.5),
        total100: s.total,
        grade: s.grade || "B",
        remark: s.remark || "BEGINNING",
      }));

  // Core Competencies calculation from terminal average
  const compAvg = displaySubjects.length > 0 ? overallTotal / displaySubjects.length : 0;
  const getCompGrade = (val: number) => {
    if (val >= 80) return "A";
    if (val >= 68) return "P";
    if (val >= 54) return "AP";
    if (val >= 40) return "D";
    return "B";
  };
  const compGrade = getCompGrade(compAvg);

  const coreCompetencies = [
    "Critical Thinking and Problem Solving",
    "Creativity and Innovation",
    "Communication Skills and Collaboration Skills",
    "Cultural Identity and Global Citizenship",
    "Personal Development and Leadership Skills",
    "Digital Literacy",
  ];

  const daysOpened = reportCard.metadata?.daysOpened ?? 0;
  const daysPresent = reportCard.metadata?.daysPresent ?? 0;

  return (
    <div className="w-full max-w-[850px] mx-auto bg-white text-black font-sans p-4 sm:p-6 border border-black shadow-lg print:shadow-none print:border-0 print:p-0 print:w-full print:max-w-none print:m-0 print:text-black">
      {/* 1. Header Box */}
      <div className="border border-black p-3 mb-2 flex items-center justify-between text-center">
        <img src="/logo.png" alt="Logo" className="w-14 h-14 sm:w-16 sm:h-16 object-contain" />
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-wide uppercase">TAIFA EBENEZER PREP. & JHS</h1>
          <p className="text-xs font-semibold">P.O.BOX TA 198</p>
          <p className="text-xs font-semibold">TAIFA-ACCRA</p>
          <p className="text-xs font-bold mt-0.5">TEL: 0244085581 / 0245502914</p>
        </div>
        <img src="/logo.png" alt="Logo" className="w-14 h-14 sm:w-16 sm:h-16 object-contain" />
      </div>

      {/* 2. Student Bio Section Grid with Full Right-Side Passport Picture Box */}
      <div className="border border-black mb-2 text-xs flex">
        {/* Left Side Bio Grid (78% width) */}
        <div className="w-[78%] border-r border-black">
          {/* Row 1: Term Report Title & Admin N° */}
          <div className="flex border-b border-black font-bold text-center bg-gray-100/50 print:bg-transparent">
            <div className="w-[62%] p-1 text-left uppercase pl-2 border-r border-black">
              END OF {reportCard.termName?.toUpperCase() || "SECOND TERM"} REPORT: {isPrimary ? "PRIMARY" : "JHS"}
            </div>
            <div className="w-[38%] p-1 flex justify-between px-2">
              <span>ADMIN N°</span>
              <span className="font-mono">{reportCard.studentIdNumber || "0"}</span>
            </div>
          </div>

          {/* Row 2: Student Name */}
          <div className="flex border-b border-black p-1.5 font-bold gap-2 items-center">
            <span>NAME:</span>
            <span className="font-normal italic uppercase text-sm">{reportCard.studentName || "0"}</span>
          </div>

          {/* Row 3: Class, Term, Class Size, Learner's Total Score */}
          <div className="grid grid-cols-4 border-b border-black text-center font-semibold">
            <div className="p-1 border-r border-black flex justify-between px-1">
              <span className="font-bold">CLASS:</span> <span>{reportCard.className || "0"}</span>
            </div>
            <div className="p-1 border-r border-black flex justify-between px-1">
              <span className="font-bold">Term:</span> <span>{reportCard.termName || "0"}</span>
            </div>
            <div className="p-1 border-r border-black flex justify-between px-1">
              <span className="font-bold">Class Size</span> <span className="font-mono">{reportCard.totalStudents || 0}</span>
            </div>
            <div className="p-1 flex justify-between px-1">
              <span className="font-bold">Learner's Total Score</span> <span className="font-mono">{overallTotal || 0}</span>
            </div>
          </div>

          {/* Row 4: Re-opening & Vacation Dates */}
          <div className="grid grid-cols-2 text-center font-semibold">
            <div className="p-1 border-r border-black flex justify-between px-2">
              <span className="font-bold">Next Term Re-opening Date</span> <span>0</span>
            </div>
            <div className="p-1 flex justify-between px-2">
              <span className="font-bold">Vacation date</span> <span>0</span>
            </div>
          </div>
        </div>

        {/* Right Side: Passport Picture Box (22% width, full height) */}
        <div className="w-[22%] flex flex-col items-center justify-center p-2 text-center font-bold text-xs tracking-wider text-gray-700 bg-gray-50/50 print:bg-transparent">
          <div>PASSPORT</div>
          <div>PICTURE</div>
        </div>
      </div>

      {/* 3. Assessment Report Legend Table */}
      <div className="border border-black mb-2 text-[10px]">
        <div className="font-bold text-center border-b border-black py-0.5 bg-gray-100/50 print:bg-transparent uppercase tracking-wider text-xs">
          ASSESSMENT REPORT
        </div>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-black font-bold text-center">
              <th className="border-r border-black p-1 w-[80px]">MARKS</th>
              <th className="border-r border-black p-1 w-[60px]">GRADING</th>
              <th className="border-r border-black p-1 w-[130px]">REMARKS</th>
              <th className="p-1">GRADE DESCRIPTION</th>
            </tr>
          </thead>
          <tbody>
            {sbcLegend.map((item, idx) => (
              <tr key={idx} className="border-b border-black last:border-0">
                <td className="border-r border-black p-1 text-center font-bold">{item.range}</td>
                <td className="border-r border-black p-1 text-center font-bold">{item.grade}</td>
                <td className="border-r border-black p-1 text-center font-bold">{item.remark}</td>
                <td className="p-1 leading-tight">{item.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 4. Subjects Table */}
      <div className="border border-black mb-2 text-xs">
        <table className="w-full border-collapse text-center">
          <thead>
            <tr className="border-b border-black font-bold">
              <th className="border-r border-black p-1.5 text-left w-[40%]" rowSpan={2}>SUBJECTS</th>
              <th className="border-r border-black p-0.5" colSpan={2}>CLASS WORK</th>
              <th className="border-r border-black p-0.5" colSpan={2}>EXAMINATION</th>
              <th className="border-r border-black p-0.5" rowSpan={2}>TOTAL<br/>100%</th>
              <th className="border-r border-black p-0.5" rowSpan={2}>GRADE</th>
              <th className="p-0.5" rowSpan={2}>REMARK</th>
            </tr>
            <tr className="border-b border-black font-bold">
              <th className="border-r border-black p-0.5 w-[8%]">100%</th>
              <th className="border-r border-black p-0.5 w-[8%]">50%</th>
              <th className="border-r border-black p-0.5 w-[8%]">100%</th>
              <th className="border-r border-black p-0.5 w-[8%]">50%</th>
            </tr>
          </thead>
          <tbody>
            {displaySubjects.map((sub, idx) => (
              <tr key={idx} className="border-b border-black">
                <td className="border-r border-black p-1 text-left font-bold">{sub.name}</td>
                <td className="border-r border-black p-1"></td>
                <td className="border-r border-black p-1 font-mono">{sub.classWork50}</td>
                <td className="border-r border-black p-1"></td>
                <td className="border-r border-black p-1 font-mono">{sub.exam50}</td>
                <td className="border-r border-black p-1 font-bold font-mono">{sub.total100}</td>
                <td className="border-r border-black p-1 font-bold">{sub.grade}</td>
                <td className="p-1 font-semibold text-[10px]">{sub.remark}</td>
              </tr>
            ))}
            <tr className="font-bold border-b border-black">
              <td className="border-r border-black p-1.5 text-right pr-4" colSpan={5}>TOTAL</td>
              <td className="border-r border-black p-1 font-mono">{overallTotal}</td>
              <td className="border-r border-black p-1"></td>
              <td className="p-1"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 5. Attendance Bar */}
      <div className="border border-black mb-2 text-xs flex justify-between items-center font-bold px-2 py-1">
        <div className="flex gap-4">
          <span>LEARNER'S TOTAL ATTENDANCE:</span>
          <span className="font-normal font-mono">{daysPresent}</span>
        </div>
        <div className="flex gap-4">
          <span>TOTAL SCHOOL DAYS:</span>
          <span className="font-normal font-mono">{daysOpened}</span>
        </div>
      </div>

      {/* 6. Lower Split Grid: Core Competencies (Left) & Terminal Bills (Right) */}
      <div className="grid grid-cols-12 gap-2 mb-2 text-xs">
        {/* Left Side: Core Competencies */}
        <div className="col-span-7 border border-black text-[11px]">
          <div className="font-bold text-center border-b border-black p-1 bg-gray-100/50 print:bg-transparent text-[10px]">
            ASSESSMENT ON CORE COMPETENCIES
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-black font-bold text-center">
                <th className="p-1 border-r border-black text-left">CORE COMPETENCY</th>
                <th className="p-1 border-r border-black w-[50px]">SCORE</th>
                <th className="p-1 w-[50px]">GRADE</th>
              </tr>
            </thead>
            <tbody>
              {coreCompetencies.map((comp, idx) => (
                <tr key={idx} className="border-b border-black">
                  <td className="p-1 border-r border-black font-semibold">{comp}</td>
                  <td className="p-1 border-r border-black text-center"></td>
                  <td className="p-1 text-center font-bold">{compGrade}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="p-1 border-r border-black">TOTAL SCORE FOR CORE COMPETENCY</td>
                <td className="p-1 border-r border-black text-center font-mono">{overallTotal}</td>
                <td className="p-1"></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Right Side: Terminal Bills */}
        <div className="col-span-5 border border-black text-[11px]">
          <div className="font-bold text-center border-b border-black p-1 bg-gray-100/50 print:bg-transparent text-[10px]">
            TERMINAL BILLS
          </div>
          <table className="w-full border-collapse">
            <tbody>
              <tr className="border-b border-black">
                <td className="p-1 border-r border-black font-semibold">SCHOOL FEES</td>
                <td className="p-1 text-right font-mono font-bold">500</td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-1 border-r border-black font-semibold">SCHOOL FEES ARREARS</td>
                <td className="p-1 text-right font-mono"></td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-1 border-r border-black font-semibold">CLASSES FEES ARREARS</td>
                <td className="p-1 text-right font-mono"></td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-1 border-r border-black font-semibold">UNIFORMS ARREARS</td>
                <td className="p-1 text-right font-mono"></td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-1 border-r border-black font-semibold">FEEDING FEES ARREARS</td>
                <td className="p-1 text-right font-mono"></td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-1 border-r border-black font-semibold">BOOKS FEE ARREARS</td>
                <td className="p-1 text-right font-mono"></td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-1 border-r border-black font-semibold">PRINTING FEE ARREARS</td>
                <td className="p-1 text-right font-mono"></td>
              </tr>
              <tr className="font-bold bg-gray-100/50 print:bg-transparent">
                <td className="p-1 border-r border-black">TOTAL(GHC)</td>
                <td className="p-1 text-right font-mono font-bold text-sm">500</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. Signatures Footer */}
      <div className="border border-black p-2 text-xs space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex gap-2 items-center">
            <span className="font-bold">Class teacher's Name:</span>
            <span className="font-bold uppercase italic">MISS EVELYN NYONATOR</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="font-bold">Head teacher's Name:</span>
            <span className="font-bold uppercase">STEPHEN K. ADUKOR (SIR ZITO)</span>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2">
          <div><span className="font-bold">Signature:</span> ______________________</div>
          <div><span className="font-bold">Sign:</span> ______________________</div>
        </div>
      </div>
    </div>
  );
}
