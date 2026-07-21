import React, { useState, useRef } from "react";
import { StudentReportCard } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Printer, Download, Upload, Image as ImageIcon, Save, FileJson } from "lucide-react";

interface ReportCardAdvancedProps {
  reportCard: StudentReportCard;
}

export default function ReportCardAdvanced({ reportCard }: ReportCardAdvancedProps) {
  const { toast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);

  // Upload States
  const [logoUrl, setLogoUrl] = useState<string>("/logo.png");
  const [passportUrl, setPassportUrl] = useState<string | null>(null);

  // Hidden File Inputs
  const logoInputRef = useRef<HTMLInputElement>(null);
  const passportInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  if (!reportCard) return null;

  const isPrimary = !(reportCard.className || "").toLowerCase().includes("jhs");

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

  // Map results & calculate component scores accurately
  const displaySubjects = isPrimary
    ? primarySubjectsList.map(name => {
        const match = reportCard.subjectResults?.find(s => 
          s.subjectName.toUpperCase().trim() === name || 
          name.includes(s.subjectName.toUpperCase().trim())
        );

        if (match) {
          const classWorkComp = match.componentScores?.find(c => c.componentName.toLowerCase().includes("class") || c.componentName.toLowerCase().includes("sba"));
          const examComp = match.componentScores?.find(c => c.componentName.toLowerCase().includes("exam") || c.componentName.toLowerCase().includes("test"));

          const classWork100 = classWorkComp ? Math.round((classWorkComp.scoreValue / classWorkComp.maxScore) * 100) : (match.total ? Math.round(match.total) : "");
          const classWork50 = classWorkComp ? Math.round(classWorkComp.weightedScore) : (match.total ? Math.round(match.total * 0.5) : 0);

          const exam100 = examComp ? Math.round((examComp.scoreValue / examComp.maxScore) * 100) : (match.total ? Math.round(match.total) : "");
          const exam50 = examComp ? Math.round(examComp.weightedScore) : (match.total ? Math.round(match.total * 0.5) : 0);

          const total100 = classWork50 + exam50;

          return {
            name,
            classWork100: classWork100 !== "" ? classWork100 : "",
            classWork50,
            exam100: exam100 !== "" ? exam100 : "",
            exam50,
            total100,
            grade: match.grade || "B",
            remark: match.remark || "BEGINNING",
          };
        }

        return {
          name,
          classWork100: "",
          classWork50: 0,
          exam100: "",
          exam50: 0,
          total100: 0,
          grade: "B",
          remark: "BEGINNING",
        };
      })
    : (reportCard.subjectResults || []).map(s => {
        const classWorkComp = s.componentScores?.find(c => c.componentName.toLowerCase().includes("class") || c.componentName.toLowerCase().includes("sba"));
        const examComp = s.componentScores?.find(c => c.componentName.toLowerCase().includes("exam") || c.componentName.toLowerCase().includes("test"));

        const classWork100 = classWorkComp ? Math.round((classWorkComp.scoreValue / classWorkComp.maxScore) * 100) : Math.round(s.total);
        const classWork50 = classWorkComp ? Math.round(classWorkComp.weightedScore) : Math.round(s.total * 0.5);

        const exam100 = examComp ? Math.round((examComp.scoreValue / examComp.maxScore) * 100) : Math.round(s.total);
        const exam50 = examComp ? Math.round(examComp.weightedScore) : Math.round(s.total * 0.5);

        const total100 = classWork50 + exam50;

        return {
          name: s.subjectName.toUpperCase(),
          classWork100,
          classWork50,
          exam100,
          exam50,
          total100,
          grade: s.grade || "B",
          remark: s.remark || "BEGINNING",
        };
      });

  const overallTotal = Math.round(displaySubjects.reduce((acc, s) => acc + s.total100, 0));

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

  // Handlers for File Uploads
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setLogoUrl(event.target.result as string);
          toast({ title: "Logo Uploaded", description: "Custom school logo updated successfully." });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePassportUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPassportUrl(event.target.result as string);
          toast({ title: "Passport Photo Uploaded", description: "Student passport photo attached." });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // JSON Export (Save Data)
  const handleSaveJson = () => {
    const payload = {
      reportCard,
      customLogo: logoUrl,
      passportPhoto: passportUrl,
      exportedAt: new Date().toISOString(),
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `report_card_${reportCard.studentIdNumber || "student"}_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast({ title: "Data Saved", description: "Report card data saved as JSON file." });
  };

  // JSON Import (Load Data)
  const handleLoadJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed.customLogo) setLogoUrl(parsed.customLogo);
          if (parsed.passportPhoto) setPassportUrl(parsed.passportPhoto);
          toast({ title: "Data Loaded", description: "Loaded report card configuration from JSON." });
        } catch (err) {
          toast({ variant: "destructive", title: "Load Failed", description: "Invalid JSON report file format." });
        }
      };
      reader.readAsText(file);
    }
  };

  // Export PDF using html2pdf.js dynamically or fallback
  const handleExportPDF = async () => {
    const element = reportRef.current;
    if (!element) return;
    try {
      if (typeof window !== "undefined" && (window as any).html2pdf) {
        const opt = {
          margin: 0.2,
          filename: `report_${reportCard.studentName?.replace(/\s+/g, "_") || "student"}.pdf`,
          image: { type: "jpeg" as const, quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: "in", format: "letter", orientation: "portrait" }
        };
        (window as any).html2pdf().set(opt).from(element).save();
        toast({ title: "Exporting PDF", description: "PDF generation started." });
      } else {
        const html2pdfModule = await import("html2pdf.js");
        const html2pdf = (html2pdfModule.default || html2pdfModule) as any;
        const opt = {
          margin: 0.2,
          filename: `report_${reportCard.studentName?.replace(/\s+/g, "_") || "student"}.pdf`,
          image: { type: "jpeg" as const, quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: "in", format: "letter", orientation: "portrait" }
        };
        html2pdf().set(opt).from(element).save();
        toast({ title: "Exporting PDF", description: "PDF generated successfully." });
      }
    } catch (err) {
      window.print();
    }
  };

  return (
    <div className="space-y-4">
      {/* Interactive Action Toolbar (Hidden when printing) */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/40 rounded-lg border border-border print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          {/* Logo Upload */}
          <Button size="sm" variant="outline" onClick={() => logoInputRef.current?.click()}>
            <ImageIcon className="w-4 h-4 mr-1.5" /> Change Logo
          </Button>
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />

          {/* Passport Photo Upload */}
          <Button size="sm" variant="outline" onClick={() => passportInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1.5" /> Upload Passport Photo
          </Button>
          <input ref={passportInputRef} type="file" accept="image/*" className="hidden" onChange={handlePassportUpload} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Save JSON */}
          <Button size="sm" variant="outline" onClick={handleSaveJson}>
            <Save className="w-4 h-4 mr-1.5" /> Save JSON
          </Button>

          {/* Load JSON */}
          <Button size="sm" variant="outline" onClick={() => jsonInputRef.current?.click()}>
            <FileJson className="w-4 h-4 mr-1.5" /> Load JSON
          </Button>
          <input ref={jsonInputRef} type="file" accept=".json" className="hidden" onChange={handleLoadJson} />

          {/* PDF Export */}
          <Button size="sm" variant="outline" onClick={handleExportPDF}>
            <Download className="w-4 h-4 mr-1.5" /> Export PDF
          </Button>

          {/* Print */}
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1.5" /> Print Report
          </Button>
        </div>
      </div>

      {/* Printable Report Card Area */}
      <div ref={reportRef} style={{ width: "100%", maxWidth: "780px", margin: "0 auto", backgroundColor: "#ffffff", color: "#000000", fontFamily: "Arial, sans-serif", fontSize: "10px", padding: "10px", boxSizing: "border-box" }}>
        {/* 1. Header Box Table */}
        <table style={{ width: "100%", border: "1px solid #000000", borderCollapse: "collapse", marginBottom: "4px" }}>
          <tbody>
            <tr>
              <td style={{ width: "14%", textAlign: "center", padding: "4px", verticalAlign: "middle" }}>
                <img src={logoUrl} alt="Logo Left" style={{ width: "48px", height: "48px", objectFit: "contain", display: "inline-block" }} />
              </td>
              <td style={{ width: "72%", textAlign: "center", padding: "3px", verticalAlign: "middle" }}>
                <div style={{ fontSize: "17px", fontWeight: "900", letterSpacing: "0.5px" }}>TAIFA EBENEZER PREP. & JHS</div>
                <div style={{ fontSize: "9.5px", fontWeight: "600" }}>P.O.BOX TA 198</div>
                <div style={{ fontSize: "9.5px", fontWeight: "600" }}>TAIFA-ACCRA</div>
                <div style={{ fontSize: "9.5px", fontWeight: "700", marginTop: "1px" }}>TEL: 0244085581 / 0245502914</div>
              </td>
              <td style={{ width: "14%", textAlign: "center", padding: "4px", verticalAlign: "middle" }}>
                <img src={logoUrl} alt="Logo Right" style={{ width: "48px", height: "48px", objectFit: "contain", display: "inline-block" }} />
              </td>
            </tr>
          </tbody>
        </table>

        {/* 2. Student Bio Section Grid (2-Column Outer Table for 100% Print Immunity) */}
        <table style={{ width: "100%", border: "1px solid #000000", borderCollapse: "collapse", marginBottom: "4px" }}>
          <tbody>
            <tr>
              {/* Left Main Bio Grid (78% width) */}
              <td style={{ width: "78%", borderRight: "1px solid #000000", verticalAlign: "top", padding: "0" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {/* Row 1: Term Report Title & Admin N° */}
                    <tr style={{ borderBottom: "1px solid #000000" }}>
                      <td style={{ width: "65%", padding: "3px 6px", fontWeight: "bold", textTransform: "uppercase", borderRight: "1px solid #000000" }}>
                        END OF {reportCard.termName?.toUpperCase() || "SECOND TERM"} REPORT: {isPrimary ? "PRIMARY" : "JHS"}
                      </td>
                      <td style={{ width: "35%", padding: "3px 6px", fontWeight: "bold" }}>
                        <span style={{ marginRight: "6px" }}>ADMIN N°</span>
                        <span style={{ fontFamily: "monospace" }}>{reportCard.studentIdNumber || "0"}</span>
                      </td>
                    </tr>

                    {/* Row 2: Student Name */}
                    <tr style={{ borderBottom: "1px solid #000000" }}>
                      <td colSpan={2} style={{ padding: "4px 6px", fontWeight: "bold" }}>
                        <span style={{ marginRight: "6px" }}>NAME:</span>
                        <span style={{ fontWeight: "normal", fontStyle: "italic", textTransform: "uppercase", fontSize: "11px" }}>{reportCard.studentName || "0"}</span>
                      </td>
                    </tr>

                    {/* Row 3: Class, Term, Class Size, Learner's Total Score */}
                    <tr style={{ borderBottom: "1px solid #000000" }}>
                      <td colSpan={2} style={{ padding: "0" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center" }}>
                          <tbody>
                            <tr>
                              <td style={{ width: "22%", padding: "3px 2px", borderRight: "1px solid #000000" }}>
                                <span style={{ fontWeight: "bold", marginRight: "3px" }}>CLASS:</span>
                                <span>{reportCard.className || "0"}</span>
                              </td>
                              <td style={{ width: "22%", padding: "3px 2px", borderRight: "1px solid #000000" }}>
                                <span style={{ fontWeight: "bold", marginRight: "3px" }}>Term:</span>
                                <span>{reportCard.termName || "0"}</span>
                              </td>
                              <td style={{ width: "22%", padding: "3px 2px", borderRight: "1px solid #000000" }}>
                                <span style={{ fontWeight: "bold", marginRight: "3px" }}>Class Size</span>
                                <span style={{ fontFamily: "monospace" }}>{reportCard.totalStudents || 0}</span>
                              </td>
                              <td style={{ width: "34%", padding: "3px 2px" }}>
                                <span style={{ fontWeight: "bold", marginRight: "3px" }}>Learner's Total Score</span>
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
                              <td style={{ width: "50%", padding: "3px 6px", borderRight: "1px solid #000000" }}>
                                <span style={{ fontWeight: "bold", marginRight: "6px" }}>Next Term Re-opening Date</span>
                                <span>0</span>
                              </td>
                              <td style={{ width: "50%", padding: "3px 6px" }}>
                                <span style={{ fontWeight: "bold", marginRight: "6px" }}>Vacation date</span>
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
              <td 
                style={{ width: "22%", verticalAlign: "middle", textAlign: "center", fontWeight: "bold", fontSize: "9.5px", color: "#374151", padding: "4px", backgroundColor: "#fafafa", cursor: "pointer" }}
                onClick={() => passportInputRef.current?.click()}
                title="Click to upload passport photo"
              >
                {passportUrl ? (
                  <img src={passportUrl} alt="Passport" style={{ width: "100%", height: "100%", maxHeight: "85px", objectFit: "cover", margin: "0 auto", borderRadius: "2px" }} />
                ) : (
                  <div>
                    <div>PASSPORT</div>
                    <div style={{ marginTop: "3px" }}>PICTURE</div>
                  </div>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 3. Assessment Report Legend Table */}
        <table style={{ width: "100%", border: "1px solid #000000", borderCollapse: "collapse", marginBottom: "4px", fontSize: "9px" }}>
          <thead>
            <tr style={{ backgroundColor: "#e5e7eb", borderBottom: "1px solid #000000" }}>
              <th colSpan={4} style={{ padding: "2.5px", textAlign: "center", textTransform: "uppercase", fontSize: "9.5px", fontWeight: "bold" }}>
                ASSESSMENT REPORT
              </th>
            </tr>
            <tr style={{ borderBottom: "1px solid #000000", textAlign: "center", fontWeight: "bold" }}>
              <th style={{ width: "75px", borderRight: "1px solid #000000", padding: "2.5px" }}>MARKS</th>
              <th style={{ width: "55px", borderRight: "1px solid #000000", padding: "2.5px" }}>GRADING</th>
              <th style={{ width: "120px", borderRight: "1px solid #000000", padding: "2.5px" }}>REMARKS</th>
              <th style={{ padding: "2.5px", textAlign: "left" }}>GRADE DESCRIPTION</th>
            </tr>
          </thead>
          <tbody>
            {sbcLegend.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: idx < sbcLegend.length - 1 ? "1px solid #000000" : "none" }}>
                <td style={{ borderRight: "1px solid #000000", padding: "2px", textAlign: "center", fontWeight: "bold" }}>{item.range}</td>
                <td style={{ borderRight: "1px solid #000000", padding: "2px", textAlign: "center", fontWeight: "bold" }}>{item.grade}</td>
                <td style={{ borderRight: "1px solid #000000", padding: "2px", textAlign: "center", fontWeight: "bold" }}>{item.remark}</td>
                <td style={{ padding: "2px", lineHeight: "1.15" }}>{item.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 4. Subjects Table */}
        <table style={{ width: "100%", border: "1px solid #000000", borderCollapse: "collapse", marginBottom: "4px", textAlign: "center", fontSize: "9.5px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #000000", fontWeight: "bold" }}>
              <th rowSpan={2} style={{ borderRight: "1px solid #000000", padding: "3px", textAlign: "left", width: "40%" }}>SUBJECTS</th>
              <th colSpan={2} style={{ borderRight: "1px solid #000000", padding: "1.5px" }}>CLASS WORK</th>
              <th colSpan={2} style={{ borderRight: "1px solid #000000", padding: "1.5px" }}>EXAMINATION</th>
              <th rowSpan={2} style={{ borderRight: "1px solid #000000", padding: "1.5px" }}>TOTAL<br/>100%</th>
              <th rowSpan={2} style={{ borderRight: "1px solid #000000", padding: "1.5px" }}>GRADE</th>
              <th rowSpan={2} style={{ padding: "1.5px" }}>REMARK</th>
            </tr>
            <tr style={{ borderBottom: "1px solid #000000", fontWeight: "bold" }}>
              <th style={{ borderRight: "1px solid #000000", padding: "1.5px", width: "8%" }}>100%</th>
              <th style={{ borderRight: "1px solid #000000", padding: "1.5px", width: "8%" }}>50%</th>
              <th style={{ borderRight: "1px solid #000000", padding: "1.5px", width: "8%" }}>100%</th>
              <th style={{ borderRight: "1px solid #000000", padding: "1.5px", width: "8%" }}>50%</th>
            </tr>
          </thead>
          <tbody>
            {displaySubjects.map((sub, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid #000000" }}>
                <td style={{ borderRight: "1px solid #000000", padding: "2.5px 4px", textAlign: "left", fontWeight: "bold" }}>{sub.name}</td>
                <td style={{ borderRight: "1px solid #000000", padding: "2.5px", fontFamily: "monospace" }}>{sub.classWork100}</td>
                <td style={{ borderRight: "1px solid #000000", padding: "2.5px", fontFamily: "monospace" }}>{sub.classWork50}</td>
                <td style={{ borderRight: "1px solid #000000", padding: "2.5px", fontFamily: "monospace" }}>{sub.exam100}</td>
                <td style={{ borderRight: "1px solid #000000", padding: "2.5px", fontFamily: "monospace" }}>{sub.exam50}</td>
                <td style={{ borderRight: "1px solid #000000", padding: "2.5px", fontWeight: "bold", fontFamily: "monospace" }}>{sub.total100}</td>
                <td style={{ borderRight: "1px solid #000000", padding: "2.5px", fontWeight: "bold" }}>{sub.grade}</td>
                <td style={{ padding: "2.5px", fontWeight: "600", fontSize: "9px" }}>{sub.remark}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: "bold", borderBottom: "1px solid #000000" }}>
              <td colSpan={5} style={{ borderRight: "1px solid #000000", padding: "3px 6px", textAlign: "right" }}>TOTAL</td>
              <td style={{ borderRight: "1px solid #000000", padding: "3px", fontFamily: "monospace" }}>{overallTotal}</td>
              <td style={{ borderRight: "1px solid #000000", padding: "3px" }}></td>
              <td style={{ padding: "3px" }}></td>
            </tr>
          </tbody>
        </table>

        {/* 5. Attendance Bar Table */}
        <table style={{ width: "100%", border: "1px solid #000000", borderCollapse: "collapse", marginBottom: "4px", fontWeight: "bold", fontSize: "9.5px" }}>
          <tbody>
            <tr>
              <td style={{ padding: "3px 6px", width: "40%" }}>
                <span style={{ marginRight: "4px" }}>LEARNER'S TOTAL ATTENDANCE:</span>
                <span style={{ fontFamily: "monospace", fontWeight: "normal" }}>{daysPresent}</span>
              </td>
              <td style={{ width: "20%", backgroundColor: "#e5e7eb", borderLeft: "1px solid #000000", borderRight: "1px solid #000000" }}></td>
              <td style={{ padding: "3px 6px", textAlign: "right", width: "40%" }}>
                <span style={{ marginRight: "4px" }}>TOTAL SCHOOL DAYS:</span>
                <span style={{ fontFamily: "monospace", fontWeight: "normal" }}>{daysOpened}</span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 6. Lower Split Grid: Core Competencies (Left) & Terminal Bills (Right) */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "4px" }}>
          <tbody>
            <tr>
              {/* Left Side: Core Competencies (58% width) */}
              <td style={{ width: "58%", verticalAlign: "top", paddingRight: "2px" }}>
                <table style={{ width: "100%", border: "1px solid #000000", borderCollapse: "collapse", fontSize: "9px" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#e5e7eb", borderBottom: "1px solid #000000" }}>
                      <th colSpan={3} style={{ padding: "2.5px", textAlign: "center", textTransform: "uppercase", fontSize: "8.5px", fontWeight: "bold" }}>
                        ASSESSMENT ON CORE COMPETENCIES
                      </th>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #000000", textAlign: "center", fontWeight: "bold" }}>
                      <th style={{ padding: "2.5px 4px", borderRight: "1px solid #000000", textAlign: "left" }}>CORE COMPETENCY</th>
                      <th style={{ padding: "2.5px", borderRight: "1px solid #000000", width: "40px" }}>SCORE</th>
                      <th style={{ padding: "2.5px", width: "40px" }}>GRADE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coreCompetencies.map((comp, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #000000" }}>
                        <td style={{ padding: "2.5px 4px", borderRight: "1px solid #000000", fontWeight: "600" }}>{comp}</td>
                        <td style={{ padding: "2.5px", borderRight: "1px solid #000000", textAlign: "center" }}></td>
                        <td style={{ padding: "2.5px", textAlign: "center", fontWeight: "bold" }}>{compGrade}</td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: "bold" }}>
                      <td style={{ padding: "2.5px 4px", borderRight: "1px solid #000000" }}>TOTAL SCORE FOR CORE COMPETENCY</td>
                      <td style={{ padding: "2.5px", borderRight: "1px solid #000000", textAlign: "center", fontFamily: "monospace" }}>{overallTotal}</td>
                      <td style={{ padding: "2.5px" }}></td>
                    </tr>
                  </tbody>
                </table>
              </td>

              {/* Right Side: Terminal Bills (42% width) */}
              <td style={{ width: "42%", verticalAlign: "top", paddingLeft: "2px" }}>
                <table style={{ width: "100%", border: "1px solid #000000", borderCollapse: "collapse", fontSize: "9px" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#e5e7eb", borderBottom: "1px solid #000000" }}>
                      <th colSpan={2} style={{ padding: "2.5px", textAlign: "center", textTransform: "uppercase", fontSize: "8.5px", fontWeight: "bold" }}>
                        TERMINAL BILLS
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #000000" }}>
                      <td style={{ padding: "2.5px 4px", borderRight: "1px solid #000000", fontWeight: "600" }}>SCHOOL FEES</td>
                      <td style={{ padding: "2.5px 4px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold" }}>500</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #000000" }}>
                      <td style={{ padding: "2.5px 4px", borderRight: "1px solid #000000", fontWeight: "600" }}>SCHOOL FEES ARREARS</td>
                      <td style={{ padding: "2.5px 4px", textAlign: "right", fontFamily: "monospace" }}></td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #000000" }}>
                      <td style={{ padding: "2.5px 4px", borderRight: "1px solid #000000", fontWeight: "600" }}>CLASSES FEES ARREARS</td>
                      <td style={{ padding: "2.5px 4px", textAlign: "right", fontFamily: "monospace" }}></td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #000000" }}>
                      <td style={{ padding: "2.5px 4px", borderRight: "1px solid #000000", fontWeight: "600" }}>UNIFORMS ARREARS</td>
                      <td style={{ padding: "2.5px 4px", textAlign: "right", fontFamily: "monospace" }}></td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #000000" }}>
                      <td style={{ padding: "2.5px 4px", borderRight: "1px solid #000000", fontWeight: "600" }}>FEEDING FEES ARREARS</td>
                      <td style={{ padding: "2.5px 4px", textAlign: "right", fontFamily: "monospace" }}></td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #000000" }}>
                      <td style={{ padding: "2.5px 4px", borderRight: "1px solid #000000", fontWeight: "600" }}>BOOKS FEE ARREARS</td>
                      <td style={{ padding: "2.5px 4px", textAlign: "right", fontFamily: "monospace" }}></td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #000000" }}>
                      <td style={{ padding: "2.5px 4px", borderRight: "1px solid #000000", fontWeight: "600" }}>PRINTING FEE ARREARS</td>
                      <td style={{ padding: "2.5px 4px", textAlign: "right", fontFamily: "monospace" }}></td>
                    </tr>
                    <tr style={{ fontWeight: "bold", backgroundColor: "#e5e7eb" }}>
                      <td style={{ padding: "2.5px 4px", borderRight: "1px solid #000000" }}>TOTAL(GHC)</td>
                      <td style={{ padding: "2.5px 4px", textAlign: "right", fontFamily: "monospace", fontSize: "10px" }}>500</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 7. Signatures Footer Table */}
        <table style={{ width: "100%", border: "1px solid #000000", borderCollapse: "collapse", fontSize: "9.5px" }}>
          <tbody>
            <tr>
              <td style={{ padding: "4px 6px", width: "50%" }}>
                <span style={{ fontWeight: "bold", marginRight: "4px" }}>Class teacher's Name:</span>
                <span style={{ fontWeight: "bold", fontStyle: "italic", textTransform: "uppercase" }}>MISS EVELYN NYONATOR</span>
              </td>
              <td style={{ padding: "4px 6px", width: "50%", textAlign: "right" }}>
                <span style={{ fontWeight: "bold", marginRight: "4px" }}>Head teacher's Name:</span>
                <span style={{ fontWeight: "bold", textTransform: "uppercase" }}>STEPHEN K. ADUKOR (SIR ZITO)</span>
              </td>
            </tr>
            <tr>
              <td style={{ padding: "4px 6px 2px 6px" }}>
                <span style={{ fontWeight: "bold" }}>Signature:</span> ______________________
              </td>
              <td style={{ padding: "4px 6px 2px 6px", textAlign: "right" }}>
                <span style={{ fontWeight: "bold" }}>Sign:</span> ______________________
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
