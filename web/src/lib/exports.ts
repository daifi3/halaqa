import { EXAM_TEMPLATE_NAME, examTemplateCsv } from './exam-csv';
import { gradesReportHtml } from './exam-report';
import type { Exam, ExamAttempt } from './types';

export function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Opens a printable page in a new tab and starts the print dialog ("Save as PDF"). */
export function printHtml(html: string, blocked: string) {
  const win = window.open('', '_blank');
  if (!win) throw new Error(blocked);
  win.document.write(html);
  win.document.close();
  win.focus();
  // Give the new tab a moment to lay out before printing.
  setTimeout(() => win.print(), 250);
}

/* ---------- Exams ---------- */

/** Reads a .csv the teacher picked. */
export async function readCsvFile(file: File) {
  return new Uint8Array(await file.arrayBuffer());
}

export async function downloadExamTemplate() {
  download(new Blob([examTemplateCsv()], { type: 'text/csv' }), EXAM_TEMPLATE_NAME);
}

/** The grade sheet, through the print dialog. */
export async function exportGrades(exam: Exam, attempts: ExamAttempt[]) {
  printHtml(gradesReportHtml(exam, attempts), 'Allow pop-ups to export the grades as PDF');
}
