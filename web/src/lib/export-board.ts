import { download, printHtml } from './exports';
import { BOARD_RATIO, boardFileName, boardToSvg, type Stroke } from './whiteboard';

/* ---------- Whiteboard ---------- */

export type BoardExportFormat = 'png' | 'pdf';

const PNG_W = 2000;
const PDF_W = 800;

export async function exportBoard(strokes: Stroke[], format: BoardExportFormat, title: string) {
  const name = boardFileName(title);
  if (format === 'pdf') {
    const w = PDF_W;
    const h = Math.round(w / BOARD_RATIO);
    printHtml(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${name}</title><style>
      @page { size: ${w}px ${h}px; margin: 0; }
      html, body { margin: 0; padding: 0; }
      svg { display: block; width: 100vw; height: auto; }
    </style></head><body>${boardToSvg(strokes, w, h)}</body></html>`, 'Allow pop-ups to export the whiteboard as PDF');
    return;
  }
  const w = PNG_W;
  const h = Math.round(w / BOARD_RATIO);
  const svgUrl = URL.createObjectURL(new Blob([boardToSvg(strokes, w, h)], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not render the whiteboard'));
      img.src = svgUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the image'))), 'image/png'));
    download(png, `${name}.png`);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
