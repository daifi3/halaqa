import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { EXAM_TEMPLATE_NAME, examTemplateCsv } from './exam-csv';

/** Lets the teacher pick a .csv file; its raw bytes, or null if they cancelled. */
export async function pickCsvFile(): Promise<Uint8Array | null> {
  // Any type: Drive and Files label CSVs inconsistently (text/csv, text/plain, octet-stream…).
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  const asset = result.assets?.[0];
  return asset ? new File(asset.uri).bytes() : null;
}

/** Saves the import template and opens the share sheet (save to Files/Drive, send by email…). */
export async function shareExamTemplate() {
  const file = new File(Paths.cache, EXAM_TEMPLATE_NAME);
  file.create({ overwrite: true });
  file.write(examTemplateCsv());
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: 'Exam template' });
}
