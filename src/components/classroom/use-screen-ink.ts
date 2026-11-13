import { useCallback, useEffect, useRef, useState } from 'react';
import { INK_FADE_MS, INK_HOLD_MS, inkColorFor, type InkAuthor, type InkTransport } from '@/lib/screen-ink';

export interface InkStroke {
  key: string;
  /** The share it was drawn on. */
  share: string;
  author: string;
  color: string;
  /** [x0, y0, x1, y1, …] as fractions of the shared picture. */
  points: number[];
  /** When the stroke last changed; it fades out INK_HOLD_MS after that. */
  lastAt: number;
  /** Your own stroke, still being drawn: it doesn't start fading yet. */
  drawing: boolean;
  mine: boolean;
}

const FLUSH_MS = 50;
/** Most strokes kept at once, so a scribbling spree can't pile up. */
const MAX_STROKES = 60;
/** Points closer than this (fraction of the picture) to the previous one are skipped. */
const MIN_STEP = 0.002;

/** 1 while a stroke is fresh, easing to 0 over the fade, after which it's removed. */
export function inkOpacity(s: InkStroke, now: number) {
  if (s.drawing) return 1;
  const age = now - s.lastAt - INK_HOLD_MS;
  return age <= 0 ? 1 : Math.max(0, 1 - age / INK_FADE_MS);
}

const strokeId = () => Math.random().toString(36).slice(2, 10);

/**
 * Strokes drawn on the share currently shown (`shareId`), yours and everyone
 * else's. `begin`/`move`/`end` take points as fractions (0..1) of the picture.
 */
export function useScreenInk(transport: InkTransport, shareId: string | null, me: InkAuthor) {
  const [all, setStrokes] = useState<InkStroke[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const shareRef = useRef(shareId);
  const meRef = useRef(me);
  useEffect(() => { meRef.current = me; }, [me]);
  useEffect(() => { shareRef.current = shareId; }, [shareId]);

  // Only the current share's strokes: a new share starts clean.
  const strokes = all.filter((s) => s.share === shareId);

  const upsert = useCallback((key: string, author: InkAuthor, points: number[], done: boolean, drawing: boolean) => {
    const share = shareRef.current;
    if (!share) return;
    setStrokes((list) => {
      const i = list.findIndex((s) => s.key === key);
      if (i < 0) {
        const next = [...list.filter((s) => s.share === share), {
          key, share, author: author.name, color: inkColorFor(author.id), points, lastAt: Date.now(),
          drawing: drawing && !done, mine: author.id === meRef.current.id,
        }];
        return next.length > MAX_STROKES ? next.slice(-MAX_STROKES) : next;
      }
      const s = list[i]!;
      const copy = list.slice();
      copy[i] = { ...s, points: points.length ? s.points.concat(points) : s.points, lastAt: Date.now(), drawing: drawing && !done };
      return copy;
    });
  }, []);

  useEffect(() => transport.subscribe((chunk, from) => {
    if (!shareRef.current || chunk.share !== shareRef.current) return;
    upsert(`${from.id}:${chunk.id}`, from, chunk.points, !!chunk.end, false);
  }), [transport, upsert]);

  // Tick while anything is on screen: fades strokes and drops the ones that are gone.
  const any = all.length > 0;
  useEffect(() => {
    if (!any) return;
    const t = setInterval(() => {
      const at = Date.now();
      setNow(at);
      setStrokes((list) => {
        const kept = list.filter((s) => s.share === shareRef.current && inkOpacity(s, at) > 0);
        return kept.length === list.length ? list : kept;
      });
    }, 50);
    return () => clearInterval(t);
  }, [any]);

  // Your stroke in progress: points not sent yet, flushed every FLUSH_MS.
  const current = useRef<{ id: string; pending: number[]; lastX: number; lastY: number; timer: ReturnType<typeof setInterval> } | null>(null);

  const flush = useCallback((end: boolean) => {
    const c = current.current;
    const share = shareRef.current;
    if (!c || !share) return;
    if (!c.pending.length && !end) return;
    transport.send({ share, id: c.id, points: c.pending, end });
    c.pending = [];
  }, [transport]);

  const end = useCallback(() => {
    const c = current.current;
    if (!c) return;
    clearInterval(c.timer);
    flush(true);
    upsert(`${meRef.current.id}:${c.id}`, meRef.current, [], true, false);
    current.current = null;
  }, [flush, upsert]);

  const begin = useCallback((x: number, y: number) => {
    if (!shareRef.current) return;
    if (current.current) end();
    const id = strokeId();
    current.current = { id, pending: [x, y], lastX: x, lastY: y, timer: setInterval(() => flush(false), FLUSH_MS) };
    upsert(`${meRef.current.id}:${id}`, meRef.current, [x, y], false, true);
  }, [end, flush, upsert]);

  const move = useCallback((x: number, y: number) => {
    const c = current.current;
    if (!c || Math.hypot(x - c.lastX, y - c.lastY) < MIN_STEP) return;
    c.lastX = x;
    c.lastY = y;
    c.pending.push(x, y);
    upsert(`${meRef.current.id}:${c.id}`, meRef.current, [x, y], false, true);
  }, [upsert]);

  // Leaving mid-stroke: stop the flush timer.
  useEffect(() => () => { if (current.current) clearInterval(current.current.timer); }, []);

  return { strokes, now, begin, move, end };
}
