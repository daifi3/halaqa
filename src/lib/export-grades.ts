import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { gradesFileName, gradesReportHtml, REPORT_PAGE } from './exam-report';
import type { Exam, ExamAttempt } from './types';

/**
 * Renders the exam's grade sheet to a PDF and opens the share sheet (save to
 * Files, send to a chat, etc.). Native counterpart of export-grades.web.ts.
 */
export async function exportGrades(exam: Exam, attempts: ExamAttempt[]) {
  const { uri } = await Print.printToFileAsync({ html: gradesReportHtml(exam, attempts), ...REPORT_PAGE });

  // expo-print names the file randomly; give it a readable name for the share sheet.
  const target = new File(Paths.cache, `${gradesFileName(exam.title)}.pdf`);
  if (target.exists) target.delete();
  const pdf = new File(uri);
  pdf.move(target);

  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(pdf.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Export grades' });
}
