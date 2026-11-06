import * as Linking from 'expo-linking';

/**
 * Join links encoded in the QR codes teachers show. They're real deep links
 * (halaqa://join?code=OOP24K), so a student can scan them with the phone's own
 * camera and land straight on the join screen — or scan in-app from /scan.
 */
export type JoinKind = 'room' | 'course';

const PATHS: Record<JoinKind, string> = { room: 'join', course: 'course/join' };
const CODE = /^[A-Z0-9]{6}$/;

export function joinLink(kind: JoinKind, code: string) {
  return Linking.createURL(`/${PATHS[kind]}`, { queryParams: { code } });
}

/** Reads a scanned QR payload. Also accepts a bare 6-character code (treated as a class). */
export function parseJoinLink(data: string): { kind: JoinKind; code: string } | null {
  const raw = data.trim().toUpperCase();
  if (CODE.test(raw)) return { kind: 'room', code: raw };
  try {
    const { path, queryParams } = Linking.parse(data.trim());
    const code = typeof queryParams?.code === 'string' ? queryParams.code.toUpperCase() : '';
    if (!CODE.test(code)) return null;
    // Dev-client URLs carry a "--/" prefix before the route; compare on the tail.
    const route = (path ?? '').replace(/^.*--\//, '').replace(/^\/+|\/+$/g, '');
    if (route === PATHS.course) return { kind: 'course', code };
    if (route === PATHS.room) return { kind: 'room', code };
    return null;
  } catch {
    return null;
  }
}
