const ExcelJS = require('exceljs');
const path = require('path');

async function buildReportCardExcel() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Taifa Ebenezer Report Card', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1 }
  });

  // Column Widths
  sheet.columns = [
    { key: 'margin', width: 2 },
    { key: 'colA', width: 22 }, // B
    { key: 'colB', width: 14 }, // C
    { key: 'colC', width: 12 }, // D
    { key: 'colD', width: 12 }, // E
    { key: 'colE', width: 10 }, // F
    { key: 'colF', width: 10 }, // G
    { key: 'colG', width: 10 }, // H
    { key: 'colH', width: 10 }, // I
    { key: 'colI', width: 14 }, // J
    { key: 'colJ', width: 12 }, // K
    { key: 'colK', width: 18 }, // L
  ];

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  const greyFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE5E7EB' }
  };

  // Helper for borders & fonts
  function styleRange(startCell, endCell, { font, fill, alignment, border = thinBorder, numberFormat }) {
    const start = sheet.getCell(startCell);
    const end = sheet.getCell(endCell);
    
    for (let r = start.row; r <= end.row; r++) {
      for (let c = start.col; c <= end.col; c++) {
        const cell = sheet.getCell(r, c);
        if (font) cell.font = font;
        if (fill) cell.fill = fill;
        if (alignment) cell.alignment = alignment;
        if (border) cell.border = border;
        if (numberFormat) cell.numFmt = numberFormat;
      }
    }
  }

  // 1. HEADER BOX (Rows 1-4)
  sheet.mergeCells('B1:L4');
  const headerCell = sheet.getCell('B1');
  headerCell.value = 'TAIFA EBENEZER PREP. & JHS\nP.O.BOX TA 198 | TAIFA-ACCRA\nTEL: 0244085581 / 0245502914';
  headerCell.font = { name: 'Arial', size: 14, bold: true };
  headerCell.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
  styleRange('B1', 'L4', { border: thinBorder });

  // 2. STUDENT BIO SECTION (Rows 5-8)
  sheet.mergeCells('B5:G5');
  sheet.getCell('B5').value = 'END OF SECOND TERM REPORT: PRIMARY';
  sheet.getCell('B5').font = { name: 'Arial', size: 10, bold: true };
  sheet.getCell('B5').alignment = { vertical: 'middle' };

  sheet.mergeCells('H5:I5');
  sheet.getCell('H5').value = 'ADMIN N°';
  sheet.getCell('H5').font = { name: 'Arial', size: 10, bold: true };

  sheet.getCell('J5').value = 'STU001';
  sheet.getCell('J5').font = { name: 'Courier New', size: 10, bold: true };

  sheet.mergeCells('B6:J6');
  sheet.getCell('B6').value = 'NAME: KOFI MENSAH';
  sheet.getCell('B6').font = { name: 'Arial', size: 11, bold: true };

  sheet.getCell('B7').value = 'CLASS: BASIC 1';
  sheet.getCell('C7').value = 'Term: Term 1';
  sheet.getCell('D7').value = 'Class Size: 8';
  sheet.mergeCells('E7:I7');
  sheet.getCell('E7').value = 'Learner\'s Total Score';
  sheet.getCell('E7').font = { name: 'Arial', size: 10, bold: true };

  sheet.getCell('J7').value = 819;
  sheet.getCell('J7').font = { name: 'Arial', size: 11, bold: true };
  sheet.getCell('J7').numFmt = '#,##0';

  sheet.mergeCells('B8:E8');
  sheet.getCell('B8').value = 'Next Term Re-opening Date: 0';

  sheet.mergeCells('F8:J8');
  sheet.getCell('F8').value = 'Vacation date: 0';

  styleRange('B5', 'J8', { border: thinBorder, alignment: { vertical: 'middle' } });

  // Right Passport Picture Box (K5:L8)
  sheet.mergeCells('K5:L8');
  const passportCell = sheet.getCell('K5');
  passportCell.value = 'PASSPORT\nPICTURE';
  passportCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF4B5563' } };
  passportCell.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
  styleRange('K5', 'L8', { border: thinBorder, fill: greyFill });

  // 3. ASSESSMENT REPORT LEGEND (Rows 10-15)
  sheet.mergeCells('B10:L10');
  sheet.getCell('B10').value = 'ASSESSMENT REPORT';
  sheet.getCell('B10').font = { name: 'Arial', size: 10, bold: true };
  sheet.getCell('B10').alignment = { horizontal: 'center', vertical: 'middle' };
  styleRange('B10', 'L10', { fill: greyFill, border: thinBorder });

  // Legend Headers
  sheet.getCell('B11').value = 'MARKS';
  sheet.getCell('C11').value = 'GRADING';
  sheet.mergeCells('D11:E11');
  sheet.getCell('D11').value = 'REMARKS';
  sheet.mergeCells('F11:L11');
  sheet.getCell('F11').value = 'GRADE DESCRIPTION';
  styleRange('B11', 'L11', { font: { name: 'Arial', size: 9, bold: true }, border: thinBorder, alignment: { horizontal: 'center' } });

  const legendRows = [
    ['100 - 80', 'A', 'ADVANCE', 'Learner exceeds core requirement in terms of knowledge, skills and understanding and can transfer them automatically and flexibly trough authentic performance tasks'],
    ['79 - 68', 'P', 'PROFICIENCY', 'Learner develops fundamental knowledge, skills and core understanding and transfers them independently through authentic performance tasks'],
    ['67 - 54', 'AP', 'APPROACHING PROFICIENCY', 'Learner develops fundamental knowledge, skills and core understanding; with little guidance; can transfer understanding through authentic performance task'],
    ['53 - 40', 'D', 'DEVELOPING', 'Learner possesses the minimum knowledge and skills but needs, help throughout the performance of authentic tasks.'],
    ['39 - Below', 'B', 'BEGINNING', 'Learner is struggling with his/her understanding due to lack of essential knowledge and skills.'],
  ];

  legendRows.forEach((row, i) => {
    const rNum = 12 + i;
    sheet.getCell(`B${rNum}`).value = row[0];
    sheet.getCell(`C${rNum}`).value = row[1];
    sheet.mergeCells(`D${rNum}:E${rNum}`);
    sheet.getCell(`D${rNum}`).value = row[2];
    sheet.mergeCells(`F${rNum}:L${rNum}`);
    sheet.getCell(`F${rNum}`).value = row[3];
    sheet.getCell(`F${rNum}`).alignment = { wrapText: true, vertical: 'middle' };
    styleRange(`B${rNum}`, `L${rNum}`, { font: { name: 'Arial', size: 8.5 }, border: thinBorder });
  });

  // 4. SUBJECTS TABLE (Rows 17-29)
  sheet.mergeCells('B17:E18');
  sheet.getCell('B17').value = 'SUBJECTS';

  sheet.mergeCells('F17:G17');
  sheet.getCell('F17').value = 'CLASS WORK';
  sheet.getCell('F18').value = '100%';
  sheet.getCell('G18').value = '50%';

  sheet.mergeCells('H17:I17');
  sheet.getCell('H17').value = 'EXAMINATION';
  sheet.getCell('H18').value = '100%';
  sheet.getCell('I18').value = '50%';

  sheet.mergeCells('J17:J18');
  sheet.getCell('J17').value = 'TOTAL\n100%';
  sheet.getCell('J17').alignment = { wrapText: true, horizontal: 'center' };

  sheet.mergeCells('K17:K18');
  sheet.getCell('K17').value = 'GRADE';

  sheet.mergeCells('L17:L18');
  sheet.getCell('L17').value = 'REMARK';

  styleRange('B17', 'L18', { font: { name: 'Arial', size: 9, bold: true }, border: thinBorder, alignment: { horizontal: 'center', vertical: 'middle' } });

  const subjects = [
    ['LITERACY (ENGLISH LANGUAGE)', '', 40, '', 40, 80, 'B2', 'Very Good'],
    ['NUMERACY (MATHEMATICS)', '', 43, '', 43, 86, 'A1', 'Excellent'],
    ['SCIENCE', '', 44, '', 44, 88, 'A1', 'Excellent'],
    ['RELIGIOUS AND MORAL EDUCATION', '', 38, '', 38, 76, 'B2', 'Very Good'],
    ['HISTORY', '', 39, '', 39, 78, 'B2', 'Very Good'],
    ['FRENCH', '', 37, '', 37, 74, 'B3', 'Good'],
    ['LITERACY (ASANTE TWI)', '', 43, '', 43, 85, 'A1', 'Excellent'],
    ['CREATIVE ARTS', '', 38, '', 38, 76, 'B2', 'Very Good'],
    ['WRITING', '', 40, '', 40, 80, 'B2', 'Very Good'],
    ['PHYSICAL EDUCATION', '', 44, '', 44, 88, 'A1', 'Excellent'],
    ['COMPUTING', '', 44, '', 44, 88, 'A1', 'Excellent'],
  ];

  subjects.forEach((s, idx) => {
    const rNum = 19 + idx;
    sheet.mergeCells(`B${rNum}:E${rNum}`);
    sheet.getCell(`B${rNum}`).value = s[0];
    sheet.getCell(`B${rNum}`).font = { name: 'Arial', size: 9, bold: true };

    sheet.getCell(`F${rNum}`).value = s[1];
    sheet.getCell(`G${rNum}`).value = s[2];
    sheet.getCell(`H${rNum}`).value = s[3];
    sheet.getCell(`I${rNum}`).value = s[4];
    sheet.getCell(`J${rNum}`).value = s[5];
    sheet.getCell(`K${rNum}`).value = s[6];
    sheet.getCell(`L${rNum}`).value = s[7];

    styleRange(`B${rNum}`, `L${rNum}`, { font: { name: 'Arial', size: 9 }, border: thinBorder, alignment: { horizontal: 'center', vertical: 'middle' } });
    sheet.getCell(`B${rNum}`).alignment = { horizontal: 'left', vertical: 'middle' };
    sheet.getCell(`J${rNum}`).numFmt = '#,##0';
  });

  // Subjects Total Row (Row 30)
  sheet.mergeCells('B30:I30');
  sheet.getCell('B30').value = 'TOTAL';
  sheet.getCell('B30').font = { name: 'Arial', size: 9.5, bold: true };
  sheet.getCell('B30').alignment = { horizontal: 'right', vertical: 'middle' };

  sheet.getCell('J30').value = { formula: 'SUM(J19:J29)', result: 819 };
  sheet.getCell('J30').font = { name: 'Arial', size: 9.5, bold: true };
  sheet.getCell('J30').numFmt = '#,##0';
  styleRange('B30', 'L30', { border: thinBorder, alignment: { horizontal: 'center' } });

  // 5. ATTENDANCE BAR (Row 32)
  sheet.mergeCells('B32:E32');
  sheet.getCell('B32').value = 'LEARNER\'S TOTAL ATTENDANCE: 8';
  sheet.getCell('B32').font = { name: 'Arial', size: 9, bold: true };

  sheet.mergeCells('F32:H32');
  styleRange('F32', 'H32', { fill: greyFill, border: thinBorder });

  sheet.mergeCells('I32:L32');
  sheet.getCell('I32').value = 'TOTAL SCHOOL DAYS: 8';
  sheet.getCell('I32').font = { name: 'Arial', size: 9, bold: true };
  sheet.getCell('I32').alignment = { horizontal: 'right' };
  styleRange('B32', 'L32', { border: thinBorder });

  // 6. LOWER SPLIT: CORE COMPETENCIES & TERMINAL BILLS (Rows 34-42)
  sheet.mergeCells('B34:G34');
  sheet.getCell('B34').value = 'ASSESSMENT ON CORE COMPETENCIES';
  sheet.getCell('B34').font = { name: 'Arial', size: 9, bold: true };
  sheet.getCell('B34').alignment = { horizontal: 'center' };
  styleRange('B34', 'G34', { fill: greyFill, border: thinBorder });

  sheet.mergeCells('H34:L34');
  sheet.getCell('H34').value = 'TERMINAL BILLS';
  sheet.getCell('H34').font = { name: 'Arial', size: 9, bold: true };
  sheet.getCell('H34').alignment = { horizontal: 'center' };
  styleRange('H34', 'L34', { fill: greyFill, border: thinBorder });

  sheet.mergeCells('B35:E35');
  sheet.getCell('B35').value = 'CORE COMPETENCY';
  sheet.getCell('F35').value = 'SCORE';
  sheet.getCell('G35').value = 'GRADE';
  styleRange('B35', 'G35', { font: { name: 'Arial', size: 8.5, bold: true }, border: thinBorder, alignment: { horizontal: 'center' } });

  sheet.mergeCells('H35:K35');
  sheet.getCell('H35').value = 'BILL TYPE';
  sheet.getCell('L35').value = 'AMOUNT (GHC)';
  styleRange('H35', 'L35', { font: { name: 'Arial', size: 8.5, bold: true }, border: thinBorder, alignment: { horizontal: 'center' } });

  const compList = [
    'Critical Thinking and Problem Solving',
    'Creativity and Innovation',
    'Communication Skills and Collaboration Skills',
    'Cultural Identity and Global Citizenship',
    'Personal Development and Leadership Skills',
    'Digital Literacy',
  ];

  const billsList = [
    ['SCHOOL FEES', 500],
    ['SCHOOL FEES ARREARS', ''],
    ['CLASSES FEES ARREARS', ''],
    ['UNIFORMS ARREARS', ''],
    ['FEEDING FEES ARREARS', ''],
    ['BOOKS FEE ARREARS', ''],
    ['PRINTING FEE ARREARS', ''],
  ];

  compList.forEach((cName, idx) => {
    const rNum = 36 + idx;
    sheet.mergeCells(`B${rNum}:E${rNum}`);
    sheet.getCell(`B${rNum}`).value = cName;
    sheet.getCell(`G${rNum}`).value = 'A';
    styleRange(`B${rNum}`, `G${rNum}`, { font: { name: 'Arial', size: 8.5 }, border: thinBorder, alignment: { horizontal: 'center' } });
    sheet.getCell(`B${rNum}`).alignment = { horizontal: 'left' };

    const bill = billsList[idx];
    sheet.mergeCells(`H${rNum}:K${rNum}`);
    sheet.getCell(`H${rNum}`).value = bill[0];
    sheet.getCell(`L${rNum}`).value = bill[1];
    if (typeof bill[1] === 'number') sheet.getCell(`L${rNum}`).numFmt = '#,##0';
    styleRange(`H${rNum}`, `L${rNum}`, { font: { name: 'Arial', size: 8.5 }, border: thinBorder });
    sheet.getCell(`L${rNum}`).alignment = { horizontal: 'right' };
  });

  // Core Comp Total & Bills Total (Row 42)
  sheet.mergeCells('B42:E42');
  sheet.getCell('B42').value = 'TOTAL SCORE FOR CORE COMPETENCY';
  sheet.getCell('F42').value = 819;
  sheet.getCell('F42').numFmt = '#,##0';
  styleRange('B42', 'G42', { font: { name: 'Arial', size: 8.5, bold: true }, border: thinBorder, alignment: { horizontal: 'center' } });

  sheet.mergeCells('H42:K42');
  sheet.getCell('H42').value = 'TOTAL(GHC)';
  sheet.getCell('L42').value = { formula: 'SUM(L36:L41)', result: 500 };
  sheet.getCell('L42').numFmt = '#,##0';
  styleRange('H42', 'L42', { font: { name: 'Arial', size: 9, bold: true }, fill: greyFill, border: thinBorder });
  sheet.getCell('L42').alignment = { horizontal: 'right' };

  // 7. FOOTER SIGNATURES (Row 44-45)
  sheet.mergeCells('B44:F44');
  sheet.getCell('B44').value = 'Class teacher\'s Name: MISS EVELYN NYONATOR';
  sheet.getCell('B44').font = { name: 'Arial', size: 9, bold: true };

  sheet.mergeCells('G44:L44');
  sheet.getCell('G44').value = 'Head teacher\'s Name: STEPHEN K. ADUKOR (SIR ZITO)';
  sheet.getCell('G44').font = { name: 'Arial', size: 9, bold: true };
  sheet.getCell('G44').alignment = { horizontal: 'right' };

  sheet.mergeCells('B45:F45');
  sheet.getCell('B45').value = 'Signature: ______________________';

  sheet.mergeCells('G45:L45');
  sheet.getCell('G45').value = 'Sign: ______________________';
  sheet.getCell('G45').alignment = { horizontal: 'right' };

  styleRange('B44', 'L45', { border: thinBorder });

  const outputPath = path.join(__dirname, 'Taifa_Ebenezer_Report_Card_Template.xlsx');
  await workbook.xlsx.writeFile(outputPath);
  console.log('Successfully created Excel file:', outputPath);
}

buildReportCardExcel().catch(console.error);
