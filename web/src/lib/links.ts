import type { IconName } from '@/components/ui/icon';
import type { RsvpStatus } from './types';
import { colors } from '@/theme';

/** One look per RSVP state, shared by the student's invite card and the teacher's list. */
export const RSVP_STYLE: Record<RsvpStatus, { label: string; icon: IconName; fg: string; bg: string }> = {
  accepted: { label: 'Accepted', icon: 'checkmark-circle', fg: colors.success, bg: colors.successSoft },
  pending: { label: 'Pending', icon: 'time-outline', fg: colors.inkSoft, bg: colors.surfaceAlt },
  declined: { label: 'Declined', icon: 'close-circle', fg: colors.danger, bg: colors.dangerSoft },
};

/**
 * Join links encoded in the QR codes teachers show. On the web they're links to
 * this site (https://…/join?code=OOP24K), so a phone camera opens the join page
 * straight away — and the mobile app's scanner reads the same path and code.
 */
export type JoinKind = 'room' | 'course';

const PATHS: Record<JoinKind, string> = { room: 'join', course: 'course/join' };
const CODE = /^[A-Z0-9]{6}$/;

export function joinLink(kind: JoinKind, code: string) {
  return `${window.location.origin}/${PATHS[kind]}?code=${encodeURIComponent(code)}`;
}

/** Reads a scanned QR payload: a web link, the app's halaqa:// link, or a bare 6-character code (a class). */
export function parseJoinLink(data: string): { kind: JoinKind; code: string } | null {
  const raw = data.trim();
  if (CODE.test(raw.toUpperCase())) return { kind: 'room', code: raw.toUpperCase() };
  try {
    const url = new URL(raw);
    const code = (url.searchParams.get('code') ?? '').toUpperCase();
    if (!CODE.test(code)) return null;
    // halaqa://join puts "join" in the host; dev-client links carry a "--/" prefix before the route.
    const path = `${url.protocol.startsWith('http') ? '' : url.host}${url.pathname}`;
    const route = path.replace(/^.*--\//, '').replace(/^\/+|\/+$/g, '');
    if (route === PATHS.course || route.endsWith(`/${PATHS.course}`)) return { kind: 'course', code };
    if (route === PATHS.room || route.endsWith(`/${PATHS.room}`)) return { kind: 'room', code };
    return null;
  } catch {
    return null;
  }
}

/* ---------- In-app viewer ---------- */

export type ViewerKind = 'pdf' | 'image';

/** Which in-app viewer can show this file, or null when it opens in a new tab. */
export function viewerKind(mimeType: string | null | undefined, url: string): ViewerKind | null {
  const mime = mimeType?.toLowerCase() ?? '';
  const path = url.split(/[?#]/)[0]!.toLowerCase();
  if (mime === 'application/pdf' || path.endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|avif|svg)$/.test(path)) return 'image';
  return null;
}

export const viewerPath = (file: { url: string; title: string; kind: ViewerKind }) =>
  `/viewer?${new URLSearchParams({ url: file.url, title: file.title, kind: file.kind })}`;

/** Copies text, falling back to a hidden field for older browsers and plain-http pages. */
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const field = document.createElement('textarea');
    field.value = text;
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    document.execCommand('copy');
    field.remove();
  }
}

/** The system share sheet where there is one, else copy to the clipboard. Resolves to what happened. */
export async function shareText(message: string): Promise<'shared' | 'copied' | 'cancelled'> {
  if (navigator.share) {
    try {
      await navigator.share({ text: message });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  await copyText(message);
  return 'copied';
}
