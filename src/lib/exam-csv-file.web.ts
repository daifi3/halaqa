import * as DocumentPicker from 'expo-document-picker';
import { EXAM_TEMPLATE_NAME, examTemplateCsv } from './exam-csv';

/** Web counterpart of exam-csv-file.ts: the browser's file picker. */
export async function pickCsvFile(): Promise<Uint8Array | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['.csv', 'text/csv', 'text/plain'] });
  const asset = result.assets?.[0];
  return asset ? new Uint8Array(await (await fetch(asset.uri)).arrayBuffer()) : null;
}

/** Browsers can't share local files, so the template downloads directly. */
export async function shareExamTemplate() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([examTemplateCsv()], { type: 'text/csv' }));
  a.download = EXAM_TEMPLATE_NAME;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
