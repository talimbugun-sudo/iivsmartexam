import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Attempt } from '../types';
import {
  formatExamTypeUz,
  formatUzDate,
  type GroupAnalyticsSummary,
  type StudentAnalyticsSummary,
  type SubjectAnalyticsSummary,
} from './analytics';

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function toPdfSafeText(text: string): string {
  return String(text || '')
    .replace(/[\u2018\u2019\u02BB\u02BC`]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-');
}

async function saveWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, filename);
}

function styleExcelHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' },
  };
  row.alignment = { vertical: 'middle', horizontal: 'left' };
  row.height = 26;
}

// ---------- EXCEL TEMPLATES & IMPORTS ----------

export async function downloadStudentImportTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("O'quvchilar shabloni");
  ws.columns = [
    { header: 'F.I.Sh.', key: 'fullName', width: 32 },
    { header: 'Guruh', key: 'groupName', width: 18 },
    { header: 'Login', key: 'login', width: 20 },
    { header: 'Parol', key: 'password', width: 18 },
    { header: 'Telefon', key: 'phone', width: 18 },
  ];
  styleExcelHeader(ws.getRow(1));
  ws.addRow({
    fullName: 'Karimov Azizbek Dilshodovich',
    groupName: '10-A',
    login: 'azizbek_10a',
    password: 'Pass1234',
    phone: '+998901234567',
  });
  ws.addRow({
    fullName: 'Tursunova Dilnoza Akmalovna',
    groupName: '10-A',
    login: 'dilnoza_10a',
    password: 'Pass1234',
    phone: '+998907654321',
  });
  await saveWorkbook(wb, 'oquvchilar_import_shablon.xlsx');
}

export interface ImportedStudentRow {
  fullName: string;
  groupName: string;
  login: string;
  password: string;
  phone?: string;
}

export async function parseStudentsExcel(file: File): Promise<ImportedStudentRow[]> {
  const wb = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("Excel faylda ishchi varaq topilmadi.");

  const rows: ImportedStudentRow[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const fullName = String(row.getCell(1).value ?? '').trim();
    const groupName = String(row.getCell(2).value ?? '').trim();
    const login = String(row.getCell(3).value ?? '').trim();
    const password = String(row.getCell(4).value ?? '').trim();
    const phone = String(row.getCell(5).value ?? '').trim();

    if (fullName && groupName && login) {
      rows.push({
        fullName,
        groupName,
        login,
        password: password || '123456',
        phone: phone || undefined,
      });
    }
  });

  if (rows.length === 0) {
    throw new Error("Excel fayldan yaroqli o‘quvchi qatorlari topilmadi. Ustunlar: F.I.Sh., Guruh, Login, Parol.");
  }
  return rows;
}

export async function downloadQuestionImportTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Savollar shabloni');
  ws.columns = [
    { header: 'Savol', key: 'text', width: 46 },
    { header: 'A', key: 'a', width: 22 },
    { header: 'B', key: 'b', width: 22 },
    { header: 'C', key: 'c', width: 22 },
    { header: 'D', key: 'd', width: 22 },
    { header: 'TogriJavob', key: 'correct', width: 14 },
    { header: 'Ball', key: 'points', width: 10 },
  ];
  styleExcelHeader(ws.getRow(1));
  ws.addRow({
    text: "Nyutonning ikkinchi qonuni formulasini ko'rsating?",
    a: 'F = m * a',
    b: 'E = m * c^2',
    c: 'P = U * I',
    d: 'A = F * s',
    correct: 'A',
    points: 5,
  });
  ws.addRow({
    text: "Yorug'likning vakuumdagi tezligi nechaga teng?",
    a: '150 000 km/s',
    b: '300 000 km/s',
    c: '450 000 km/s',
    d: '1 080 km/s',
    correct: 'B',
    points: 5,
  });
  await saveWorkbook(wb, 'savollar_import_shablon.xlsx');
}

export interface ImportedQuestionRow {
  text: string;
  options: [string, string, string, string];
  correctIndex: number;
  points: number;
}

export async function parseQuestionsExcel(file: File): Promise<ImportedQuestionRow[]> {
  const wb = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("Excel faylda ishchi varaq topilmadi.");

  const questions: ImportedQuestionRow[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const text = String(row.getCell(1).value ?? '').trim();
    const a = String(row.getCell(2).value ?? '').trim();
    const b = String(row.getCell(3).value ?? '').trim();
    const c = String(row.getCell(4).value ?? '').trim();
    const d = String(row.getCell(5).value ?? '').trim();
    const correctRaw = String(row.getCell(6).value ?? 'A').trim().toUpperCase();
    const pointsNum = Number(row.getCell(7).value ?? 5);

    if (!text || !a || !b || !c || !d) return;

    let correctIndex = 0;
    if (correctRaw === 'B' || correctRaw === '2') correctIndex = 1;
    else if (correctRaw === 'C' || correctRaw === '3') correctIndex = 2;
    else if (correctRaw === 'D' || correctRaw === '4') correctIndex = 3;

    questions.push({
      text,
      options: [a, b, c, d],
      correctIndex,
      points: Number.isFinite(pointsNum) && pointsNum > 0 ? pointsNum : 5,
    });
  });

  if (questions.length === 0) {
    throw new Error("Excel fayldan savollar topilmadi. Ustunlar: Savol, A, B, C, D, TogriJavob (A/B/C/D), Ball.");
  }
  return questions;
}

// ---------- EXCEL REPORTS ----------

export async function exportStudentsReportExcel(summaries: StudentAnalyticsSummary[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("O'quvchilar hisoboti");
  ws.columns = [
    { header: 'F.I.Sh.', key: 'fullName', width: 28 },
    { header: 'Guruh', key: 'group', width: 14 },
    { header: 'Login', key: 'login', width: 18 },
    { header: 'Topshirilgan testlar', key: 'count', width: 18 },
    { header: "O'rtacha (%)", key: 'avg', width: 14 },
    { header: 'Eng yuqori (%)', key: 'max', width: 15 },
    { header: 'Eng past (%)', key: 'min', width: 15 },
    { header: "O'sish (%)", key: 'growth', width: 14 },
  ];
  styleExcelHeader(ws.getRow(1));
  for (const s of summaries) {
    ws.addRow({
      fullName: s.student.fullName,
      group: s.student.groupName,
      login: s.student.login,
      count: s.attemptsCount,
      avg: s.avgPercentage,
      max: s.highestPercentage,
      min: s.lowestPercentage,
      growth: s.growthDelta > 0 ? `+${s.growthDelta}` : s.growthDelta,
    });
  }
  await saveWorkbook(wb, 'oquvchilar_hisoboti.xlsx');
}

export async function exportGroupsReportExcel(groups: GroupAnalyticsSummary[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Guruhlar hisoboti');
  ws.columns = [
    { header: 'Reyting', key: 'rank', width: 10 },
    { header: 'Guruh nomi', key: 'name', width: 22 },
    { header: 'Kurator', key: 'curator', width: 24 },
    { header: "O'quvchilar soni", key: 'students', width: 16 },
    { header: 'Test urinishlari', key: 'attempts', width: 16 },
    { header: "O'rtacha ball (%)", key: 'avg', width: 16 },
    { header: "O'sish (%)", key: 'growth', width: 14 },
    { header: 'Yetakchi', key: 'top', width: 26 },
  ];
  styleExcelHeader(ws.getRow(1));
  groups.forEach((g, idx) => {
    ws.addRow({
      rank: idx + 1,
      name: g.group.name,
      curator: g.group.curatorName || '—',
      students: g.studentsCount,
      attempts: g.attemptsCount,
      avg: g.avgPercentage,
      growth: g.growthDelta > 0 ? `+${g.growthDelta}` : g.growthDelta,
      top: g.topStudentName || '—',
    });
  });
  await saveWorkbook(wb, 'guruhlar_hisoboti.xlsx');
}

export async function exportSubjectsReportExcel(subjects: SubjectAnalyticsSummary[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Fanlar hisoboti');
  ws.columns = [
    { header: 'Fan nomi', key: 'name', width: 26 },
    { header: 'Kod', key: 'code', width: 14 },
    { header: "O'qituvchi", key: 'teacher', width: 24 },
    { header: 'Topshirilgan testlar', key: 'attempts', width: 18 },
    { header: "O'rtacha (%)", key: 'avg', width: 15 },
    { header: "O'tish foizi (>=55%)", key: 'pass', width: 20 },
  ];
  styleExcelHeader(ws.getRow(1));
  for (const s of subjects) {
    ws.addRow({
      name: s.subject.name,
      code: s.subject.code || '—',
      teacher: s.subject.teacherName || '—',
      attempts: s.attemptsCount,
      avg: s.avgPercentage,
      pass: `${s.passRate}%`,
    });
  }
  await saveWorkbook(wb, 'fanlar_hisoboti.xlsx');
}

export async function exportIndividualStudentExcel(summary: StudentAnalyticsSummary) {
  const wb = new ExcelJS.Workbook();
  const infoSheet = wb.addWorksheet('Profil');
  infoSheet.columns = [
    { header: "Ko'rsatkich", key: 'k', width: 28 },
    { header: 'Qiymat', key: 'v', width: 34 },
  ];
  styleExcelHeader(infoSheet.getRow(1));
  infoSheet.addRow({ k: 'F.I.Sh.', v: summary.student.fullName });
  infoSheet.addRow({ k: 'Guruh', v: summary.student.groupName });
  infoSheet.addRow({ k: 'Login', v: summary.student.login });
  infoSheet.addRow({ k: 'Topshirilgan testlar', v: summary.attemptsCount });
  infoSheet.addRow({ k: "Umumiy o'rtacha (%)", v: `${summary.avgPercentage}%` });
  infoSheet.addRow({ k: 'Eng yuqori natija (%)', v: `${summary.highestPercentage}%` });
  infoSheet.addRow({ k: 'Eng past natija (%)', v: `${summary.lowestPercentage}%` });
  infoSheet.addRow({ k: "O'sish foizi", v: `${summary.growthDelta > 0 ? '+' : ''}${summary.growthDelta}%` });

  const historySheet = wb.addWorksheet('Testlar tarixi');
  historySheet.columns = [
    { header: 'Test nomi', key: 'title', width: 30 },
    { header: 'Fan', key: 'subject', width: 20 },
    { header: 'Nazorat turi', key: 'type', width: 18 },
    { header: 'Ball', key: 'score', width: 14 },
    { header: 'Foiz (%)', key: 'pct', width: 12 },
    { header: 'Sana', key: 'date', width: 20 },
  ];
  styleExcelHeader(historySheet.getRow(1));
  for (const a of summary.history) {
    historySheet.addRow({
      title: a.testTitle,
      subject: a.subjectName,
      type: formatExamTypeUz(a.examType),
      score: `${a.score}/${a.maxScore}`,
      pct: `${a.percentage}%`,
      date: formatUzDate(a.submittedAt),
    });
  }
  await saveWorkbook(wb, `${summary.student.login}_profil_hisobot.xlsx`);
}

// ---------- PDF REPORTS ----------

function createPdfDoc(title: string, subtitle: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(toPdfSafeText(`ORALIQ NAZORAT — ${title}`), 14, 13);
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  doc.text(toPdfSafeText(`${subtitle} | Sana: ${formatUzDate(new Date())}`), 14, 21);
  doc.setTextColor(15, 23, 42);
  return doc;
}

export function exportStudentsReportPdf(summaries: StudentAnalyticsSummary[], title = "O'quvchilar hisoboti") {
  const doc = createPdfDoc(title, `Jami o'quvchilar: ${summaries.length}`);
  autoTable(doc, {
    startY: 35,
    head: [['#', 'F.I.Sh.', 'Guruh', 'Testlar', "O'rtacha", 'Max / Min', "O'sish"]],
    body: summaries.map((s, idx) => [
      idx + 1,
      toPdfSafeText(s.student.fullName),
      toPdfSafeText(s.student.groupName),
      s.attemptsCount,
      `${s.avgPercentage}%`,
      `${s.highestPercentage}% / ${s.lowestPercentage}%`,
      `${s.growthDelta > 0 ? '+' : ''}${s.growthDelta}%`,
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 138] },
  });
  doc.save('oquvchilar_hisoboti.pdf');
}

export function exportGroupsReportPdf(groups: GroupAnalyticsSummary[]) {
  const doc = createPdfDoc('Guruhlar reytingi va hisoboti', `Jami guruhlar: ${groups.length}`);
  autoTable(doc, {
    startY: 35,
    head: [['Reyting', 'Guruh', 'Kurator', "O'quvchilar", 'Urinishlar', "O'rtacha", "O'sish"]],
    body: groups.map((g, idx) => [
      idx + 1,
      toPdfSafeText(g.group.name),
      toPdfSafeText(g.group.curatorName || '-'),
      g.studentsCount,
      g.attemptsCount,
      `${g.avgPercentage}%`,
      `${g.growthDelta > 0 ? '+' : ''}${g.growthDelta}%`,
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 138] },
  });
  doc.save('guruhlar_hisoboti.pdf');
}

export function exportSubjectsReportPdf(subjects: SubjectAnalyticsSummary[]) {
  const doc = createPdfDoc('Fanlar kesimida hisobot', `Jami fanlar: ${subjects.length}`);
  autoTable(doc, {
    startY: 35,
    head: [['#', 'Fan nomi', 'Kod', "O'qituvchi", 'Urinishlar', "O'rtacha", "O'tish foizi"]],
    body: subjects.map((s, idx) => [
      idx + 1,
      toPdfSafeText(s.subject.name),
      toPdfSafeText(s.subject.code || '-'),
      toPdfSafeText(s.subject.teacherName || '-'),
      s.attemptsCount,
      `${s.avgPercentage}%`,
      `${s.passRate}%`,
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 138] },
  });
  doc.save('fanlar_hisoboti.pdf');
}

export function exportIndividualStudentPdf(summary: StudentAnalyticsSummary) {
  const doc = createPdfDoc(
    `Individual profil: ${summary.student.fullName}`,
    `Guruh: ${summary.student.groupName} | Login: ${summary.student.login}`,
  );
  autoTable(doc, {
    startY: 35,
    head: [["Ko'rsatkich", 'Natija']],
    body: [
      ['Topshirilgan testlar soni', String(summary.attemptsCount)],
      ["Umumiy o'rtacha ball", `${summary.avgPercentage}%`],
      ['Eng yuqori natija', `${summary.highestPercentage}%`],
      ['Eng past natija', `${summary.lowestPercentage}%`],
      ["O'sish ko'rsatkichi", `${summary.growthDelta > 0 ? '+' : ''}${summary.growthDelta}%`],
      ['Kuchli fan', toPdfSafeText(summary.strongestSubject || '-')],
      ['E’tibor talab fan', toPdfSafeText(summary.weakestSubject || '-')],
    ],
    styles: { fontSize: 9.5, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42] },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 110;
  autoTable(doc, {
    startY: finalY + 8,
    head: [['Test nomi', 'Fan', 'Turi', 'Ball', 'Foiz', 'Sana']],
    body: summary.history.map((a: Attempt) => [
      toPdfSafeText(a.testTitle),
      toPdfSafeText(a.subjectName),
      toPdfSafeText(formatExamTypeUz(a.examType)),
      `${a.score}/${a.maxScore}`,
      `${a.percentage}%`,
      formatUzDate(a.submittedAt),
    ]),
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 58, 138] },
  });

  doc.save(`${summary.student.login}_individual_hisobot.pdf`);
}
