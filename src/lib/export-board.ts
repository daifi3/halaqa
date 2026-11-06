import { ImageFormat, Skia } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { BOARD_RATIO, boardFileName, boardToSvg, type Stroke } from './whiteboard';

/** Export resolution — well above any phone board so the PNG stays sharp when zoomed. */
const PNG_W = 2000;
/** PDF page in points: landscape, same 4:3 as the board. */
const PDF_W = 800;

export type BoardExportFormat = 'png' | 'pdf';

/**
 * Renders the board off-screen and opens the share sheet (save to Files/Photos,
 * send to a chat, etc.). Native counterpart of export-board.web.ts.
 */
export async function exportBoard(strokes: Stroke[], format: BoardExportFormat, title: string) {
  const name = boardFileName(title);
  const file = format === 'png' ? await renderPng(strokes, name) : await renderPdf(strokes, name);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(file.uri, format === 'png'
    ? { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Export whiteboard' }
    : { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Export whiteboard' });
}

async function renderPng(strokes: Stroke[], name: string) {
  const w = PNG_W;
  const h = Math.round(w / BOARD_RATIO);
  const svg = Skia.SVG.MakeFromString(boardToSvg(strokes, w, h));
  const surface = Skia.Surface.Make(w, h);
  if (!svg || !surface) throw new Error('Could not render the whiteboard');
  surface.getCanvas().drawSvg(svg, w, h);
  surface.flush();
  const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.PNG);

  const file = new File(Paths.cache, `${name}.png`);
  file.create({ overwrite: true });
  await file.write(bytes);
  return file;
}

async function renderPdf(strokes: Stroke[], name: string) {
  const w = PDF_W;
  const h = Math.round(w / BOARD_RATIO);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page { size: ${w}px ${h}px; margin: 0; }
    html, body { margin: 0; padding: 0; }
    svg { display: block; }
  </style></head><body>${boardToSvg(strokes, w, h)}</body></html>`;
  const { uri } = await Print.printToFileAsync({ html, width: w, height: h, margins: { top: 0, right: 0, bottom: 0, left: 0 } });

  // expo-print names the file randomly; give it a readable name for the share sheet.
  const target = new File(Paths.cache, `${name}.pdf`);
  if (target.exists) target.delete();
  const pdf = new File(uri);
  pdf.move(target);
  return pdf;
}
