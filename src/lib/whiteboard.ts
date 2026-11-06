/**
 * Whiteboard model + wire protocol.
 *
 * Coordinates are normalised to 0..1 on a fixed 4:3 board, so a stroke drawn on
 * a tablet lands in the same spot on a small phone. Messages travel over the
 * LiveKit data channel (reliable, topic "wb") — no extra server needed.
 */

import { mathGroup, renderTex } from './math';

export const BOARD_RATIO = 4 / 3;
export const BOARD_BG = '#FFFFFF';
export const WB_TOPIC = 'wb';

export type ShapeKind = 'line' | 'arrow' | 'rect' | 'ellipse';
export type StrokeKind = 'pen' | ShapeKind | 'math';

export interface Stroke {
  id: string;
  /** Freehand when absent, so boards from older app versions still load. */
  kind?: StrokeKind;
  color: string;
  /**
   * Line width as a fraction of board width (so it scales with the board).
   * For math it's the font size, also as a fraction of board width.
   */
  width: number;
  /**
   * Flattened normalised points. Pen: [x0, y0, x1, y1, ...]. Shapes: start and
   * end corner [x0, y0, x1, y1]. Math: top-left corner [x, y].
   */
  points: number[];
  /** TeX source, for math. */
  text?: string;
}

export const isShape = (k: string | undefined): k is ShapeKind => k === 'line' || k === 'arrow' || k === 'rect' || k === 'ellipse';

export type WbMessage =
  | { t: 'b'; id: string; c: string; w: number; p: number[]; k?: StrokeKind; x?: string } // begin stroke / place item
  | { t: 'e'; id: string; p: number[] } // move a shape's end corner while it's being dragged
  | { t: 'a'; id: string; p: number[] } // append points
  | { t: 'u'; id: string } // undo (remove stroke)
  | { t: 'c' } // clear board
  | { t: 'r' } // late joiner asks for the current board (and whether it's open)
  | { t: 'o'; open: boolean } // teacher opens / closes the board for everyone
  | { t: 's'; strokes: Stroke[]; allow: boolean } // full board snapshot
  | { t: 'p'; allow: boolean }; // teacher allows / forbids students drawing

export interface WbTransport {
  send(msg: WbMessage): void;
  /** Returns an unsubscribe function. */
  subscribe(handler: (msg: WbMessage) => void): () => void;
}

export const noopTransport: WbTransport = { send: () => {}, subscribe: () => () => {} };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const encodeWb = (msg: WbMessage) => encoder.encode(JSON.stringify(msg));
export function decodeWb(payload: Uint8Array): WbMessage | null {
  try {
    return JSON.parse(decoder.decode(payload)) as WbMessage;
  } catch {
    return null;
  }
}

/** Round to 4 decimals — keeps messages small without visible loss. */
export const q = (n: number) => Math.round(n * 10000) / 10000;

/** On-screen stroke width in pixels for a board `w` pixels wide. */
export const strokePx = (width: number, w: number) => Math.max(1.5, width * w);

/**
 * The whole board as a standalone SVG document — the single source for every
 * export, so the PNG and the PDF match exactly. PDFs embed it as vectors.
 */
export function boardToSvg(strokes: Stroke[], w: number, h: number) {
  const paths = strokes
    .filter((s) => s.points.length >= 2)
    .map((s) => {
      if (s.kind === 'math') {
        try {
          return mathGroup(renderTex(s.text ?? ''), s.color, s.points[0]! * w, s.points[1]! * h, s.width * w);
        } catch {
          return '';
        }
      }
      return `<path d="${strokePath(s, w, h)}" stroke="${s.color}" stroke-width="${strokePx(s.width, w).toFixed(1)}" ` +
        'fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="${BOARD_BG}"/>${paths}</svg>`;
}

/** Filesystem-safe export name, e.g. "Object-oriented design – whiteboard 2026-10-31". */
export function boardFileName(title: string) {
  const safe = title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Halaqa';
  return `${safe} – whiteboard ${new Date().toISOString().slice(0, 10)}`;
}

/** SVG path for any line-drawn item: freehand or one of the shapes. */
export function strokePath(s: Stroke, w: number, h: number) {
  return isShape(s.kind) ? shapePath(s.kind, s.points, w, strokePx(s.width, w), h) : strokeToSvg(s.points, w, h);
}

const f = (n: number) => n.toFixed(1);

/** Outline of a shape spanning two corners, in pixels. */
export function shapePath(kind: ShapeKind, p: number[], w: number, lineW: number, h: number) {
  const x0 = p[0]! * w, y0 = p[1]! * h, x1 = (p[2] ?? p[0]!) * w, y1 = (p[3] ?? p[1]!) * h;
  switch (kind) {
    case 'line':
      return `M${f(x0)} ${f(y0)} L${f(x1)} ${f(y1)}`;
    case 'arrow': {
      // Head scales with the line weight but stays readable on thin lines.
      const len = Math.max(12, lineW * 4);
      const a = Math.atan2(y1 - y0, x1 - x0);
      const spread = 0.45;
      const hx = (d: number) => f(x1 - len * Math.cos(a + d));
      const hy = (d: number) => f(y1 - len * Math.sin(a + d));
      return `M${f(x0)} ${f(y0)} L${f(x1)} ${f(y1)} M${hx(spread)} ${hy(spread)} L${f(x1)} ${f(y1)} L${hx(-spread)} ${hy(-spread)}`;
    }
    case 'rect':
      return `M${f(x0)} ${f(y0)} L${f(x1)} ${f(y0)} L${f(x1)} ${f(y1)} L${f(x0)} ${f(y1)} Z`;
    case 'ellipse': {
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const rx = Math.max(Math.abs(x1 - x0) / 2, 0.5), ry = Math.max(Math.abs(y1 - y0) / 2, 0.5);
      return `M${f(cx - rx)} ${f(cy)} A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)} A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)} Z`;
    }
  }
}

/**
 * Builds a smooth SVG path from points using quadratic curves through midpoints.
 * Points are scaled from normalised space to pixels.
 */
export function strokeToSvg(points: number[], w: number, h: number) {
  if (points.length < 2) return '';
  const X = (i: number) => (points[i]! * w).toFixed(1);
  const Y = (i: number) => (points[i + 1]! * h).toFixed(1);
  if (points.length === 2) {
    // A single tap: draw a tiny segment so the round cap renders a dot.
    return `M${X(0)} ${Y(0)} L${(points[0]! * w + 0.1).toFixed(1)} ${Y(0)}`;
  }
  let d = `M${X(0)} ${Y(0)}`;
  for (let i = 2; i < points.length - 2; i += 2) {
    const mx = ((points[i]! + points[i + 2]!) / 2) * w;
    const my = ((points[i + 1]! + points[i + 3]!) / 2) * h;
    d += ` Q${X(i)} ${Y(i)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const last = points.length - 2;
  d += ` L${X(last)} ${Y(last)}`;
  return d;
}
