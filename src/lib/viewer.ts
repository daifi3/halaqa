import { router } from 'expo-router';

export type ViewerKind = 'pdf' | 'image';

/** Which in-app viewer can show this file, or null when it has to open in another app. */
export function viewerKind(mimeType: string | null | undefined, url: string): ViewerKind | null {
  const mime = mimeType?.toLowerCase() ?? '';
  const path = url.split(/[?#]/)[0]!.toLowerCase();
  if (mime === 'application/pdf' || path.endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic|heif|bmp|avif)$/.test(path)) return 'image';
  return null;
}

/** Opens the full-screen viewer for a PDF or image. */
export function openViewer(file: { url: string; title: string; kind: ViewerKind }) {
  router.push({ pathname: '/viewer', params: { url: file.url, title: file.title, kind: file.kind } });
}
