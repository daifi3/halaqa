import { TRUE_FALSE } from './exam';
import type { ExamQuestion, ExamQuestionKind } from './types';

/**
 * Exams imported from a spreadsheet. One table, one row per item:
 *
 *   type         | question                 | option A … option F | correct      | points
 *   title        | Midterm – Chapter 1      |                     |              |
 *   instructions | Answer every question.   |                     |              |
 *   choice       | What is 2 + 2?           | 3 | 4 | 5           | B            | 2
 *   truefalse    | The Earth orbits the Sun |                     | True         | 1
 *   written      | Explain recursion.       |                     |              | 5
 *
 * Limits match the backend (ExamController): title 3–120, prompt ≤ 1000,
 * option ≤ 300, points 1–100, at most 100 questions.
 */

export const EXAM_TEMPLATE_NAME = 'halaqa-exam-template.csv';
export const MAX_QUESTIONS = 100;
const LETTERS = 'ABCDEF';

const HEADER = ['type', 'question', ...[...LETTERS].map((l) => `option ${l}`), 'correct', 'points'];

/** A filled-in example teachers copy over. ASCII only, so any spreadsheet opens it cleanly. */
export function examTemplateCsv() {
  const row = (type: string, question: string, options: string[], correct: string, points: string) =>
    [type, question, ...[...LETTERS].map((_, i) => options[i] ?? ''), correct, points];
  const rows = [
    HEADER,
    row('title', 'Midterm - Chapter 1', [], '', ''),
    row('instructions', 'Answer every question. You have one attempt.', [], '', ''),
    row('choice', 'What is 2 + 2?', ['3', '4', '5', '22'], 'B', '2'),
    row('choice', 'Which of these is a prime number?', ['4', '6', '7'], 'C', '1'),
    row('truefalse', 'The Earth orbits the Sun.', [], 'True', '1'),
    row('written', 'Explain the difference between a stack and a queue.', [], '', '5'),
  ];
  // "sep=," makes Excel split columns on commas whatever the computer's language.
  return 'sep=,\r\n' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const csvCell = (s: string) => (/[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/* ---------- Reading ---------- */

export interface ImportedExam {
  title: string | null;
  instructions: string | null;
  questions: ExamQuestion[];
}

export type ImportResult = { ok: true; exam: ImportedExam } | { ok: false; errors: string[] };

/** Bytes of a .csv file → the exam it describes, or every problem found, by row. */
export function parseExamCsv(bytes: Uint8Array, newId: () => string): ImportResult {
  // Keep each row's line number as the spreadsheet shows it, for error messages.
  let rows = splitRows(decodeText(bytes))
    .map((cells, i) => ({ cells, line: i + 1 }))
    .filter((r) => r.cells.some((c) => c.trim()));
  if (rows[0]?.cells[0]?.trim().toLowerCase().startsWith('sep=')) rows = rows.slice(1);

  const columns = mapHeader(rows[0]?.cells ?? []);
  if (!columns) {
    return { ok: false, errors: ['The first row must be the template’s header: type, question, option A … option F, correct, points.'] };
  }

  const errors: string[] = [];
  const exam: ImportedExam = { title: null, instructions: null, questions: [] };
  rows.slice(1).forEach(({ cells, line }) => {
    const cell = (key: string) => (cells[columns[key] ?? -1] ?? '').trim();
    const kind = TYPES[norm(cell('type'))];
    const text = cell('question');
    const fail = (msg: string) => errors.push(`Row ${line}: ${msg}`);

    if (!kind) return fail(`unknown type “${cell('type')}”. Use title, instructions, choice, truefalse or written.`);
    if (kind === 'title') {
      if (text.length < 3 || text.length > 120) return fail('the title must be 3 to 120 characters.');
      exam.title = text;
      return;
    }
    if (kind === 'instructions') {
      if (text.length > 4000) return fail('instructions are limited to 4000 characters.');
      exam.instructions = text;
      return;
    }

    if (!text) return fail('the question is empty.');
    if (text.length > 1000) return fail('the question is longer than 1000 characters.');
    const points = cell('points') ? Number(cell('points').replace(',', '.')) : 1;
    if (!Number.isInteger(points) || points < 1 || points > 100) return fail('points must be a whole number from 1 to 100.');

    const q: ExamQuestion = { id: newId(), kind, prompt: text, options: [], correct: null, points };
    if (kind === 'truefalse') {
      const answer = TRUE_WORDS.has(norm(cell('correct'))) ? 0 : FALSE_WORDS.has(norm(cell('correct'))) ? 1 : -1;
      if (answer < 0) return fail('the correct answer must be True or False.');
      q.options = TRUE_FALSE;
      q.correct = answer;
    } else if (kind === 'choice') {
      // Options keep their letter, even when a column in between is left empty.
      const options = [...LETTERS]
        .map((letter) => ({ letter, text: cell(`option${letter.toLowerCase()}`) }))
        .filter((o) => o.text);
      if (options.length < 2) return fail('a multiple-choice question needs at least 2 options.');
      if (options.some((o) => o.text.length > 300)) return fail('an option is longer than 300 characters.');
      const answer = cell('correct');
      const byLetter = /^[a-f]$/i.test(answer) ? answer.toUpperCase() : /^[1-6]$/.test(answer) ? LETTERS[Number(answer) - 1] : null;
      const index = byLetter
        ? options.findIndex((o) => o.letter === byLetter)
        : options.findIndex((o) => o.text.toLowerCase() === answer.toLowerCase());
      if (index < 0) return fail('the correct answer must be the letter of a filled option (A to F).');
      q.options = options.map((o) => o.text);
      q.correct = index;
    }
    exam.questions.push(q);
  });

  if (!errors.length && !exam.questions.length) errors.push('No questions found. Add rows of type choice, truefalse or written.');
  if (exam.questions.length > MAX_QUESTIONS) errors.push(`An exam can have at most ${MAX_QUESTIONS} questions; this file has ${exam.questions.length}.`);
  return errors.length ? { ok: false, errors } : { ok: true, exam };
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_\-/]+/g, '');

const TYPES: Record<string, ExamQuestionKind | 'title' | 'instructions'> = {
  title: 'title', titre: 'title',
  instructions: 'instructions', instruction: 'instructions', consignes: 'instructions',
  choice: 'choice', multiplechoice: 'choice', mcq: 'choice', qcm: 'choice',
  truefalse: 'truefalse', tf: 'truefalse', vraifaux: 'truefalse',
  written: 'written', open: 'written', text: 'written', redaction: 'written',
};
const TRUE_WORDS = new Set(['true', 't', 'vrai', 'v', 'yes', 'oui', '1']);
const FALSE_WORDS = new Set(['false', 'f', 'faux', 'no', 'non', '0']);

/** Header cells → column index by key: type, question, optiona…optionf, correct, points. */
function mapHeader(header: string[]): Record<string, number> | null {
  const keys: Record<string, number> = {};
  header.forEach((h, i) => {
    const k = norm(h);
    const key = k === 'prompt' ? 'question' : k === 'answer' ? 'correct' : /^option[1-6]$/.test(k) ? `option${LETTERS[Number(k.slice(6)) - 1]!.toLowerCase()}` : k;
    if (!(key in keys)) keys[key] = i;
  });
  return 'type' in keys && 'question' in keys ? keys : null;
}

/** RFC 4180 rows, with the delimiter Excel used: "," — or ";" on French and other locales. */
function splitRows(text: string): string[][] {
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const sep = /^sep=(.)/i.exec(firstLine)?.[1]
    ?? [',', ';', '\t'].reduce((best, d) => (count(firstLine, d) > count(firstLine, best) ? d : best), ',');

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c !== '"') cell += c;
      else if (text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = false;
    } else if (c === '"' && !cell) {
      quoted = true;
    } else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows;
}

const count = (s: string, ch: string) => s.split(ch).length - 1;

/** UTF-8 (with or without BOM), else Windows-1252 — what Excel's plain "CSV" format saves. */
export function decodeText(bytes: Uint8Array) {
  let text = new TextDecoder().decode(bytes);
  if (text.includes('�')) text = Array.from(bytes, (b) => String.fromCharCode(CP1252[b - 0x80] ?? b)).join('');
  return text.replace(/^﻿/, '');
}

// Windows-1252 differs from Latin-1 only in 0x80–0x9F.
const CP1252 = [
  0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0x8d, 0x17d, 0x8f,
  0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x9d, 0x17e, 0x178,
];
