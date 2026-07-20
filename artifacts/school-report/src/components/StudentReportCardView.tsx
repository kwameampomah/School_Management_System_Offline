import { StudentReportCard } from "@workspace/api-client-react";

export default function StudentReportCardView({ reportCard }: { reportCard: StudentReportCard }) {
  if (!reportCard) return null;

  const isPrimary = !(reportCard.className || "").toLowerCase().includes("jhs");
  const overallTotal = Math.round(reportCard.subjectResults?.reduce((acc, s) => acc + s.total, 0) || 0);

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
        const score100 = match ? Math.round(match.total) : 0;
        return {
          name,
          classWork50: Math.round(score100 * 0.5),
          exam50: Math.round(score100 * 0.5),
          total100: score100,
          grade: match?.grade || "B",
          remark: match?.remark || "BEGINNING",
        };
      })
    : (reportCard.subjectResults || []).map(s => {
        const score100 = Math.round(s.total);
        return {
          name: s.subjectName.toUpperCase(),
          classWork50: Math.round(score100 * 0.5),
          exam50: Math.round(score100 * 0.5),
          total100: score100,
          grade: s.grade || "B",
          remark: s.remark || "BEGINNING",
        };
      });

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
    <div style={{ width: "100%", maxWidth: "800px", margin: "0 auto", backgroundColor: "#ffffff", color: "#000000", fontFamily: "sans-serif", fontSize: "11px", padding: "12px", boxSizing: "border-box" }}>
      {/* 1. Header Box Table */}
      <table style={{ width: "100%", border: "1px solid #000000", borderCollapse: "collapse", marginBottom: "6px" }}>
        <tbody>
          <tr>
            <td style={{ width: "15%", textAlign: "center", padding: "6px", verticalAlign: "middle" }}>
              <img src="/logo.png" alt="Logo" style={{ width: "50px", height: "50px", objectFit: "contain", display: "inline-block" }} />
            </td>
            <td style={{ width: "70%", textAlign: "center", padding: "4px", verticalAlign: "middle" }}>
              <div style={{ fontSize: "18px", fontWeight: "900", letterSpacing: "0.5px" }}>TAIFA EBENEZER PREP. & JHS</div>
              <div style={{ fontSize: "10px", fontWeight: "600" }}>P.O.BOX TA 198</div>
              <div style={{ fontSize: "10px", fontWeight: "600" }}>TAIFA-ACCRA</div>
              <div style={{ fontSize: "10px", fontWeight: "700", marginTop: "2px" }}>TEL: 0244085581 / 0245502914</div>
            </td>
            <td style={{ width: "15%", textAlign: "center", padding: "6px", verticalAlign: "middle" }}>
              <img src="/logo.png" alt="Logo" style={{ width: "50px", height: "50px", objectFit: "contain", display: "inline-block" }} />
            </td>
          </tr>
        </tbody>
      </table>

      {/* 2. Student Bio Section Grid (2-Column Outer Table for 100% Print Immunity) */}
      <table style={{ width: "100%", border: "1px solid #000000", borderCollapse: "collapse", marginBottom: "6px" }}>
        <tbody>
          <tr>
            {/* Left Main Bio Grid (78% width) */}
            <td style={{ width: "78%", borderRight: "1px solid #000000", verticalAlign: "top", padding: "0" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {/* Row 1: Term Report Title & Admin N° */}
                  <tr style={{ borderBottom: "1px solid #000000", backgroundColor: "#f3f4f6" }}>
                    <td style={{ width: "65%", padding: "4px 8px", fontWeight: "bold", textTransform: "uppercase", borderRight: "1px solid #000000" }}>
                      END OF {reportCard.termName?.toUpperCase() || "SECOND TERM"} REPORT: {isPrimary ? "PRIMARY" : "JHS"}
                    </td>
                    <td style={{ width: "35%", padding: "4px 8px", fontWeight: "bold" }}>
                      <span style={{ marginRight: "6px" }}>ADMIN N°</span>
                      <span style={{ fontFamily: "monospace" }}>{reportCard.studentIdNumber || "0"}</span>
                    </td>
                  </tr>

                  {/* Row 2: Student Name */}
                  <tr style={{ borderBottom: "1px solid #000000" }}>
                    <td colSpan={2} style={{ padding: "5px 8px", fontWeight: "bold" }}>
                      <span style={{ marginRight: "6px" }}>NAME:</span>
                      <span style={{ fontWeight: "normal", fontStyle: "italic", textTransform: "uppercase", fontSize: "12px" }}>{reportCard.studentName || "0"}</span>
                    </td>
                  </tr>

                  {/* Row 3: Class, Term, Class Size, Learner's Total Score */}
                  <tr style={{ borderBottom: "1px solid #000000" }}>
                    <td colSpan={2} style={{ padding: "0" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center" }}>
                        <tbody>
                          <tr>
                            <td style={{ width: "25%", padding: "4px 2px", borderRight: "1px solid #000000" }}>
                              <span style={{ fontWeight: "bold", marginRight: "4px" }}>CLASS:</span>
                              <span>{reportCard.className || "0"}</span>
                            </td>
                            <td style={{ width: "25%", padding: "4px 2px", borderRight: "1px solid #000000" }}>
                              <span style={{ fontWeight: "bold", marginRight: "4px" }}>Term:</span>
                              <span>{reportCard.termName || "0"}</span>
                            </td>
                            <td style={{ width: "25%", padding: "4px 2px", borderRight: "1px solid #000000" }}>
                              <span style={{ fontWeight: "bold", marginRight: "4px" }}>Class Size</span>
                              <span style={{ fontFamily: "monospace" }}>{reportCard.totalStudents || 0}</span>
                            </td>
                            <td style={{ width: "25%", padding: "4px 2px" }}>
                              <span style={{ fontWeight: "bold", marginRight: "4px" }}>Learner's Total Score</span>
                              <span style={{ fontFamily: "monospace", fontWeight: "bold" }}>{overallTotal}</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  {/* Row 4: Re-opening & Vacation Dates */}
                  <tr>
                    <td colSpan={2} style={{ padding: "0" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <tbody>
                          <tr>
                            <td style={{ width: "50%", padding: "4px 8px", borderRight: "1px solid #000000" }}>
                              <span style={{ fontWeight: "bold", marginRight: "8px" }}>Next Term Re-opening Date</span>
                              <span>0</span>
                            </td>
                            <td style={{ width: "50%", padding: "4px 8px" }}>
                              <span style={{ fontWeight: "bold", marginRight: "8px" }}>Vacation date</span>
                              <span>0</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>

            {/* Right Side: Passport Picture Box (22% width, full height) */}
            <td style={{ width: "22%", verticalAlign: "middle", textAlign: "center", fontWeight: "bold", fontSize: "10px", color: "#374151", padding: "8px", backgroundColor: "#f9fafb" }}>
              <div>PASSPORT</div>
              <div style={{ marginTop: "4px" }}>PICTURE</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 3. Assessment Report Legend Table */}
      <table style={{ width: "100%", border: "1px solid #000000", borderCollapse: "collapse", marginBottom: "6px", fontSize: "9.5px" }}>
        <thead>
          <tr style={{ backgroundColor: "#f3f4f6", borderBottom: "1px solid #000000" }}>
            <th colSpan={4} style={{ padding: "3px", textAlign: "center", textTransform: "uppercase", fontSize: "10px", fontWeight: "bold" }}>
              ASSESSMENT REPORT
            </th>
          </tr>
          <tr style={{ borderBottom: "1px solid #000000", textAlign: "center", fontWeight: "bold" }}>
            <th style={{ width: "80px", borderRight: "1px solid #000000", padding: "3px" }}>MARKS</th>
            <th style={{ width: "60px", borderRight: "1px solid #000000", padding: "3px" }}>GRADING</th>
            <th style={{ width: "130px", borderRight: "1px solid #000000", padding: "3px" }}>REMARKS</th>
            <th style={{ padding: "3px", textAlign: "left" }}>GRADE DESCRIPTION</th>
          </tr>
        </thead>
        <tbody>
          {sbcLegend.map((item, idx) => (
            <tr key={idx} style={{ borderBottom: idx < sbcLegend.length - 1 ? "1px solid #000000" : "none" }}>
              <td style={{ borderRight: "1px solid #000000", padding: "2.5px", textAlign: "center", fontWeight: "bold" }}>{item.range}</td>
              <td style={{ borderRight: "1px solid #000000", padding: "2.5px", textAlign: "center", fontWeight: "bold" }}>{item.grade}</td>
              <td style={{ borderRight: "1px solid #000000", padding: "2.5px", textAlign: "center", fontWeight: "bold" }}>{item.remark}</td>
              <td style={{ padding: "2.5px", lineHeight: "1.2" }}>{item.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 4. Subjects Table */}
      <table style={{ width: "100%", border: "1px solid #000000", borderCollapse: "collapse", marginBottom: "6px", textAlign: "center" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #000000", fontWeight: "bold" }}>
            <th rowSpan={2} style={{ borderRight: "1px solid #000000", padding: "4px", textAlign: "left", width: "38%" }}>SUBJECTS</th>
            <th colSpan={2} style={{ borderRight: "1px solid #000000", padding: "2px" }}>CLASS WORK</th>
            <th colSpan={2} style={{ borderRight: "1px solid #000000", padding: "2px" }}>EXAMINATION</th>
            <th rowSpan={2} style={{ borderRight: "1px solid #000000", padding: "2px" }}>TOTAL<br/>100%</th>
            <th rowSpan={2} style={{ borderRight: "1px solid #000000", padding: "2px" }}>GRADE</th>
            <th rowSpan={2} style={{ padding: "2px" }}>REMARK</th>
          </tr>
          <tr style={{ borderBottom: "1px solid #000000", fontWeight: "bold" }}>
            <th style={{ borderRight: "1px solid #000000", padding: "2px", width: "8%" }}>100%</th>
            <th style={{ borderRight: "1px solid #000000", padding: "2px", width: "8%" }}>50%</th>
            <th style={{ borderRight: "1px solid #000000", padding: "2px", width: "8%" }}>100%</th>
            <th style={{ borderRight: "1px solid #000000", padding: "2px", width: "8%" }}>50%</th>
          </tr>
        </thead>
        <tbody>
          {displaySubjects.map((sub, idx) => (
            <tr key={idx} style={{ borderBottom: "1px solid #000000" }}>
              <td style={{ borderRight: "1px solid #000000", padding: "3px 5px", textAlign: "left", fontWeight: "bold" }}>{sub.name}</td>
              <td style={{ borderRight: "1px solid #000000", padding: "3px" }}></td>
              <td style={{ borderRight: "1px solid #000000", padding: "3px", fontFamily: "monospace" }}>{sub.classWork50}</td>
              <td style={{ borderRight: "1px solid #000000", padding: "3px" }}></td>
              <td style={{ borderRight: "1px solid #000000", padding: "3px", fontFamily: "monospace" }}>{sub.exam50}</td>
              <td style={{ borderRight: "1px solid #000000", padding: "3px", fontWeight: "bold", fontFamily: "monospace" }}>{sub.total100}</td>
              <td style={{ borderRight: "1px solid #000000", padding: "3px", fontWeight: "bold" }}>{sub.grade}</td>
              <td style={{ padding: "3px", fontWeight: "600", fontSize: "9.5px" }}>{sub.remark}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: "bold", borderBottom: "1px solid #000000" }}>
            <td colSpan={5} style={{ borderRight: "1px solid #000000", padding: "4px 8px", textAlign: "right" }}>TOTAL</td>
            <td style={{ borderRight: "1px solid #000000", padding: "4px", fontFamily: "monospace" }}>{overallTotal}</td>
            <td style={{ borderRight: "1px solid #000000", padding: "4px" }}></td>
            <td style={{ padding: "4px" }}></td>
          </tr>
        </tbody>
      </table>

      {/* 5. Attendance Bar Table */}
      <table style={{ width: "100%", border: "1px solid #000000", borderCollapse: "collapse", marginBottom: "6px", fontWeight: "bold" }}>
        <tbody>
          <tr>
            <td style={{ padding: "4px 8px" }}>
              <span style={{ marginRight: "6px" }}>LEARNER'S TOTAL ATTENDANCE:</span>
              <span style={{ fontFamily: "monospace", fontWeight: "normal" }}>{daysPresent}</span>
            </td>
            <td style={{ padding: "4px 8px", textAlign: "right" }}>
              <span style={{ marginRight: "6px" }}>TOTAL SCHOOL DAYS:</span>
              <span style={{ fontFamily: "monospace", fontWeight: "normal" }}>{daysOpened}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 6. Lower Split Grid: Core Competencies (Left) & Terminal Bills (Right) */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "6px" }}>
        <tbody>
          <tr>
            {/* Left Side: Core Competencies (58% width) */}
            <td style={{ width: "58%", verticalAlign: "top", paddingRight: "3px" }}>
              <table style={{ width: "100%", border: "1px solid #000000", borderCollapse: "collapse", fontSize: "9.5px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f3f4f6", borderBottom: "1px solid #000000" }}>
                    <th colSpan={3} style={{ padding: "3px", textAlign: "center", textTransform: "uppercase", fontSize: "9px", fontWeight: "bold" }}>
                      ASSESSMENT ON CORE COMPETENCIES
                    </th>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #000000", textAlign: "center", fontWeight: "bold" }}>
                    <th style={{ padding: "3px 5px", borderRight: "1px solid #000000", textAlign: "left" }}>CORE COMPETENCY</th>
                    <th style={{ padding: "3px", borderRight: "1px solid #000000", width: "45px" }}>SCORE</th>
                    <th style={{ padding: "3px", width: "45px" }}>GRADE</th>
                  </tr>
                </thead>
                <tbody>
                  {coreCompetencies.map((comp, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #000000" }}>
                      <td style={{ padding: "3px 5px", borderRight: "1px solid #000000", fontWeight: "600" }}>{comp}</td>
                      <td style={{ padding: "3px", borderRight: "1px solid #000000", textAlign: "center" }}></td>
                      <td style={{ padding: "3px", textAlign: "center", fontWeight: "bold" }}>{compGrade}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: "bold" }}>
                    <td style={{ padding: "3px 5px", borderRight: "1px solid #000000" }}>TOTAL SCORE FOR CORE COMPETENCY</td>
                    <td style={{ padding: "3px", borderRight: "1px solid #000000", textAlign: "center", fontFamily: "monospace" }}>{overallTotal}</td>
                    <td style={{ padding: "3px" }}></td>
                  </tr>
                </tbody>
              </table>
            </td>

            {/* Right Side: Terminal Bills (42% width) */}
            <td style={{ width: "42%", verticalAlign: "top", paddingLeft: "3px" }}>
              <table style={{ width: "100%", border: "1px solid #000000", borderCollapse: "collapse", fontSize: "9.5px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f3f4f6", borderBottom: "1px solid #000000" }}>
                    <th colSpan={2} style={{ padding: "3px", textAlign: "center", textTransform: "uppercase", fontSize: "9px", fontWeight: "bold" }}>
                      TERMINAL BILLS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #000000" }}>
                    <td style={{ padding: "3px 5px", borderRight: "1px solid #000000", fontWeight: "600" }}>SCHOOL FEES</td>
                    <td style={{ padding: "3px 5px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold" }}>500</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #000000" }}>
                    <td style={{ padding: "3px 5px", borderRight: "1px solid #000000", fontWeight: "600" }}>SCHOOL FEES ARREARS</td>
                    <td style={{ padding: "3px 5px", textAlign: "right", fontFamily: "monospace" }}></td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #000000" }}>
                    <td style={{ padding: "3px 5px", borderRight: "1px solid #000000", fontWeight: "600" }}>CLASSES FEES ARREARS</td>
                    <td style={{ padding: "3px 5px", textAlign: "right", fontFamily: "monospace" }}></td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #000000" }}>
                    <td style={{ padding: "3px 5px", borderRight: "1px solid #000000", fontWeight: "600" }}>UNIFORMS ARREARS</td>
                    <td style={{ padding: "3px 5px", textAlign: "right", fontFamily: "monospace" }}></td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #000000" }}>
                    <td style={{ padding: "3px 5px", borderRight: "1px solid #000000", fontWeight: "600" }}>FEEDING FEES ARREARS</td>
                    <td style={{ padding: "3px 5px", textAlign: "right", fontFamily: "monospace" }}></td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #000000" }}>
                    <td style={{ padding: "3px 5px", borderRight: "1px solid #000000", fontWeight: "600" }}>BOOKS FEE ARREARS</td>
                    <td style={{ padding: "3px 5px", textAlign: "right", fontFamily: "monospace" }}></td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #000000" }}>
                    <td style={{ padding: "3px 5px", borderRight: "1px solid #000000", fontWeight: "600" }}>PRINTING FEE ARREARS</td>
                    <td style={{ padding: "3px 5px", textAlign: "right", fontFamily: "monospace" }}></td>
                  </tr>
                  <tr style={{ fontWeight: "bold", backgroundColor: "#f3f4f6" }}>
                    <td style={{ padding: "3px 5px", borderRight: "1px solid #000000" }}>TOTAL(GHC)</td>
                    <td style={{ padding: "3px 5px", textAlign: "right", fontFamily: "monospace", fontSize: "11px" }}>500</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 7. Signatures Footer Table */}
      <table style={{ width: "100%", border: "1px solid #000000", borderCollapse: "collapse", padding: "6px" }}>
        <tbody>
          <tr>
            <td style={{ padding: "6px", width: "50%" }}>
              <span style={{ fontWeight: "bold", marginRight: "6px" }}>Class teacher's Name:</span>
              <span style={{ fontWeight: "bold", fontStyle: "italic", textTransform: "uppercase" }}>MISS EVELYN NYONATOR</span>
            </td>
            <td style={{ padding: "6px", width: "50%", textAlign: "right" }}>
              <span style={{ fontWeight: "bold", marginRight: "6px" }}>Head teacher's Name:</span>
              <span style={{ fontWeight: "bold", textTransform: "uppercase" }}>STEPHEN K. ADUKOR (SIR ZITO)</span>
            </td>
          </tr>
          <tr>
            <td style={{ padding: "6px 6px 4px 6px" }}>
              <span style={{ fontWeight: "bold" }}>Signature:</span> ______________________
            </td>
            <td style={{ padding: "6px 6px 4px 6px", textAlign: "right" }}>
              <span style={{ fontWeight: "bold" }}>Sign:</span> ______________________
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
