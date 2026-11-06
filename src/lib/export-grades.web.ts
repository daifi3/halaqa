import { gradesReportHtml } from './exam-report';
import type { Exam, ExamAttempt } from './types';

/**
 * Web counterpart of export-grades.ts. Browsers can't share local files, so the
 * grade sheet opens in the print dialog ("Save as PDF") — expo-print on web would
 * print the whole app page instead.
 */
export async function exportGrades(exam: Exam, attempts: ExamAttempt[]) {
  const win = window.open('', '_blank');
  if (!win) throw new Error('Allow pop-ups to export the grades as PDF');
  win.document.write(gradesReportHtml(exam, attempts));
  win.document.close();
  win.focus();
  win.print();
}
