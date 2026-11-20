import mammoth from 'mammoth';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import type { ImportedQuestionRow } from './exportUtils';

function normalizeCorrectLetter(raw: string): number {
  const clean = raw.trim().toUpperCase();
  if (clean.startsWith('B') || clean === '2') return 1;
  if (clean.startsWith('C') || clean === '3') return 2;
  if (clean.startsWith('D') || clean === '4') return 3;
  return 0;
}

function parseTableQuestionsFromHtml(html: string): ImportedQuestionRow[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tables = Array.from(doc.querySelectorAll('table'));
  const results: ImportedQuestionRow[] = [];

  for (const table of tables) {
    const rows = Array.from(table.querySelectorAll('tr'));
    for (let i = 0; i < rows.length; i++) {
      const cells = Array.from(rows[i].querySelectorAll('td, th')).map((c) =>
        (c.textContent || '').trim(),
      );
      if (cells.length < 5) continue;

      // Skip header row
      if (
        i === 0 &&
        /savol|question/i.test(cells[0]) &&
        (/variant|a/i.test(cells[1]) || /javob/i.test(cells[5] || ''))
      ) {
        continue;
      }

      const text = cells[0];
      const a = cells[1];
      const b = cells[2];
      const c = cells[3];
      const d = cells[4];
      const correctRaw = cells[5] || 'A';
      const pointsRaw = Number(cells[6] || 5);

      if (!text || !a || !b || !c || !d) continue;

      results.push({
        text,
        options: [a, b, c, d],
        correctIndex: normalizeCorrectLetter(correctRaw),
        points: Number.isFinite(pointsRaw) && pointsRaw > 0 ? pointsRaw : 5,
      });
    }
  }

  return results;
}

function parseHemisFormat(rawText: string): ImportedQuestionRow[] {
  if (!rawText.includes('====') || !rawText.includes('++++')) return [];
  const blocks = rawText
    .split(/\+{3,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  const results: ImportedQuestionRow[] = [];

  for (const block of blocks) {
    const parts = block
      .split(/={3,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length < 5) continue;

    const questionText = parts[0];
    const optionParts = parts.slice(1, 5);
    let correctIndex = 0;
    const cleanedOptions: string[] = optionParts.map((opt, idx) => {
      if (opt.startsWith('#') || opt.startsWith('*') || opt.startsWith('+')) {
        correctIndex = idx;
        return opt.slice(1).trim();
      }
      return opt;
    });

    if (questionText && cleanedOptions.every((o) => o.length > 0)) {
      results.push({
        text: questionText,
        options: cleanedOptions as [string, string, string, string],
        correctIndex,
        points: 5,
      });
    }
  }

  return results;
}

function parseNumberedFormat(rawText: string): ImportedQuestionRow[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const results: ImportedQuestionRow[] = [];

  let currentText = '';
  let currentOptions: string[] = [];
  let currentCorrect = 0;
  let hasExplicitCorrect = false;
  let currentPoints = 5;

  const flush = () => {
    if (currentText && currentOptions.length >= 4) {
      results.push({
        text: currentText.replace(/^\d+[\.\)]\s*/, '').trim(),
        options: [
          currentOptions[0],
          currentOptions[1],
          currentOptions[2],
          currentOptions[3],
        ],
        correctIndex: hasExplicitCorrect ? currentCorrect : 0,
        points: currentPoints,
      });
    }
    currentText = '';
    currentOptions = [];
    currentCorrect = 0;
    hasExplicitCorrect = false;
    currentPoints = 5;
  };

  const optionRegex = /^([*+]?)\s*([A-Da-d])[\)\.\:\-]\s*(.+)$/;
  const answerLineRegex = /^(?:to['‘’]?g['‘’]?ri\s*javob|javob|answer)\s*[:\-]\s*([A-Da-d1-4])/i;
  const pointsLineRegex = /^(?:ball|points?|score)\s*[:\-]\s*(\d+(?:\.\d+)?)/i;
  const questionStartRegex = /^\d+[\.\)]\s+(.+)$/;

  for (const line of lines) {
    const ansMatch = line.match(answerLineRegex);
    if (ansMatch) {
      currentCorrect = normalizeCorrectLetter(ansMatch[1]);
      hasExplicitCorrect = true;
      continue;
    }

    const ptsMatch = line.match(pointsLineRegex);
    if (ptsMatch) {
      const p = Number(ptsMatch[1]);
      if (Number.isFinite(p) && p > 0) currentPoints = p;
      continue;
    }

    const optMatch = line.match(optionRegex);
    if (optMatch && currentText) {
      const prefixMark = optMatch[1];
      let body = optMatch[3].trim();
      const trailingMark = body.endsWith('*') || body.endsWith('(to‘g‘ri)') || body.endsWith("(to'g'ri)");
      if (body.endsWith('*')) body = body.slice(0, -1).trim();
      body = body.replace(/\(to['‘’]?g['‘’]?ri\)$/i, '').trim();

      const idx = currentOptions.length;
      if (prefixMark === '*' || prefixMark === '+' || trailingMark) {
        currentCorrect = idx;
        hasExplicitCorrect = true;
      }
      if (currentOptions.length < 4) {
        currentOptions.push(body);
      }
      continue;
    }

    if (questionStartRegex.test(line)) {
      if (currentOptions.length >= 4) {
        flush();
      } else if (currentText && currentOptions.length > 0) {
        // incomplete previous question; discard and start new
        currentText = '';
        currentOptions = [];
      }
      currentText = line;
      continue;
    }

    // Continuation of question text or new unnumbered question after 4 options
    if (currentOptions.length >= 4) {
      flush();
      currentText = line;
    } else if (!currentText) {
      currentText = line;
    } else if (currentOptions.length === 0) {
      currentText = `${currentText} ${line}`.trim();
    }
  }

  flush();
  return results;
}

export async function parseQuestionsWord(file: File): Promise<ImportedQuestionRow[]> {
  if (!file.name.toLowerCase().endsWith('.docx')) {
    throw new Error('Faqat .docx formatidagi Word fayllarini yuklash mumkin.');
  }

  const arrayBuffer = await file.arrayBuffer();

  // 1. Check for Word table-based questions
  const htmlRes = await mammoth.convertToHtml({ arrayBuffer });
  const tableQuestions = parseTableQuestionsFromHtml(htmlRes.value);
  if (tableQuestions.length > 0) {
    return tableQuestions;
  }

  // 2. Extract raw text and try HEMIS (++++) or Numbered (1. ... *A) B) C) D))
  const textRes = await mammoth.extractRawText({ arrayBuffer });
  const rawText = textRes.value || '';

  const hemisQuestions = parseHemisFormat(rawText);
  if (hemisQuestions.length > 0) {
    return hemisQuestions;
  }

  const numberedQuestions = parseNumberedFormat(rawText);
  if (numberedQuestions.length > 0) {
    return numberedQuestions;
  }

  throw new Error(
    "Word fayldan savollar aniqlanmadi. Namuna formatlardan biridan foydalaning: 1. Savol, *A) ..., B) ..., C) ..., D) ... yoki jadval ko‘rinishi.",
  );
}

export async function downloadWordQuestionTemplate() {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: 'ORALIQ NAZORAT — Word (.docx) Savollar Import Shablon',
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "To'g'ri javob varianti oldiga * (yulduzcha) qo'ying yoki pastiga 'Javob: A' deb yozing.",
                italics: true,
              }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: '1. Kvadrat tenglamaning diskriminanti formulasi qaysi?' }),
          new Paragraph({ text: '*A) D = b^2 - 4ac' }),
          new Paragraph({ text: 'B) D = b^2 + 4ac' }),
          new Paragraph({ text: 'C) D = 2a - b' }),
          new Paragraph({ text: 'D) D = a^2 + b^2' }),
          new Paragraph({ text: 'Ball: 5' }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: "2. O'zbekiston Respublikasi Konstitutsiyasi qachon qabul qilingan?" }),
          new Paragraph({ text: 'A) 1991-yil 1-sentabr' }),
          new Paragraph({ text: '*B) 1992-yil 8-dekabr' }),
          new Paragraph({ text: 'C) 1993-yil 15-noyabr' }),
          new Paragraph({ text: 'D) 1990-yil 20-iyun' }),
          new Paragraph({ text: 'Ball: 5' }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'savollar_import_namuna.docx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
