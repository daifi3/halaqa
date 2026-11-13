/**
 * Drawing on a shared screen: anyone in class can circle or underline something
 * on the screen being shared, to point the sharer (and everyone else) at it.
 *
 * Strokes ride the LiveKit data channel on their own topic, like reactions, and
 * are never stored: each one stays for INK_HOLD_MS after it's drawn, then fades.
 * Points are fractions (0..1) of the shared picture, so they land on the same
 * spot whatever size the screen is shown at.
 */

export const INK_TOPIC = 'ink';
/** How long a finished stroke stays on screen… */
export const INK_HOLD_MS = 6000;
/** …and how long it then takes to fade away. */
export const INK_FADE_MS = 500;
/** One color per person, picked from their id, so you can tell who drew what. */
export const INK_COLORS = ['#FF3B30', '#FFD60A', '#30D158', '#0A84FF', '#FF375F', '#FF9F0A', '#BF5AF2'] as const;

/** A piece of a stroke. Strokes are sent in pieces while they're drawn, so others see them appear live. */
export interface InkChunk {
  /** Identity of the person whose share it was drawn on; strokes for an older share are ignored. */
  share: string;
  /** Stroke id, unique for its author. */
  id: string;
  /** New points [x0, y0, x1, y1, …], fractions of the shared picture, appended to the stroke. */
  points: number[];
  /** The last piece of the stroke. */
  end?: boolean;
}

export interface InkAuthor {
  id: string;
  name: string;
}

export interface InkTransport {
  send(chunk: InkChunk): void;
  /** Returns an unsubscribe function. */
  subscribe(handler: (chunk: InkChunk, from: InkAuthor) => void): () => void;
}

const SCALE = 1000;
const MAX_POINTS = 1000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const encodeInk = (c: InkChunk) =>
  encoder.encode(JSON.stringify({ s: c.share, i: c.id, p: c.points.map((v) => Math.round(v * SCALE)), ...(c.end ? { e: 1 } : {}) }));

export function decodeInk(payload: Uint8Array): InkChunk | null {
  try {
    const m = JSON.parse(decoder.decode(payload)) as { s?: unknown; i?: unknown; p?: unknown; e?: unknown };
    if (typeof m.s !== 'string' || m.s.length > 200 || typeof m.i !== 'string' || m.i.length > 40) return null;
    if (!Array.isArray(m.p) || m.p.length % 2 || m.p.length > MAX_POINTS * 2) return null;
    if (!m.p.every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
    const points = (m.p as number[]).map((v) => Math.min(SCALE, Math.max(0, v)) / SCALE);
    return { share: m.s, id: m.i, points, end: m.e === 1 };
  } catch {
    return null;
  }
}

export function inkColorFor(authorId: string) {
  let h = 0;
  for (let i = 0; i < authorId.length; i++) h = (h * 31 + authorId.charCodeAt(i)) | 0;
  return INK_COLORS[Math.abs(h) % INK_COLORS.length]!;
}

/** Mock mode: nobody else is drawing, but your own strokes still show and fade. */
export const noopInkTransport: InkTransport = { send: () => {}, subscribe: () => () => {} };

/** Where a picture of the given aspect ratio sits when fitted ("contain") into a box. */
export function containRect(boxW: number, boxH: number, aspect: number | null | undefined) {
  if (!aspect || !boxW || !boxH) return { x: 0, y: 0, w: boxW, h: boxH };
  if (boxW / boxH > aspect) {
    const w = boxH * aspect;
    return { x: (boxW - w) / 2, y: 0, w, h: boxH };
  }
  const h = boxW / aspect;
  return { x: 0, y: (boxH - h) / 2, w: boxW, h };
}
