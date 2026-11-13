import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState, type PointerEvent } from 'react';
import { Icon, McIcon, type IconName } from '@/components/ui/icon';
import type { MdiName } from '@/components/ui/mdi';
import { Spinner } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { alert } from '@/lib/dialog';
import { exportBoard, type BoardExportFormat } from '@/lib/export-board';
import { mathGroup, mathSize, renderTex } from '@/lib/math';
import {
  BOARD_BG, BOARD_RATIO, isShape, q, strokePath, strokePx, type ShapeKind, type Stroke, type WbMessage, type WbTransport,
} from '@/lib/whiteboard';
import { colors, radius } from '@/theme';
import { MathComposer } from './math-composer';

const PALETTE = ['#16171C', '#4B44E0', '#E5484D', '#1F9D6B', '#E0A23C'];
const SIZES = [0.004, 0.008, 0.016];
const ERASER_WIDTH = 0.045;
const FLUSH_MS = 40;
/** A shape dragged shorter than this (fraction of the board) was a stray click — drop it. */
const MIN_SHAPE = 0.012;

type Tool = 'pen' | ShapeKind | 'math' | 'eraser';

const TOOLS: { tool: Tool; icon: MdiName; label: string; hostOnly?: boolean }[] = [
  { tool: 'pen', icon: 'pencil', label: 'Pen' },
  { tool: 'line', icon: 'vector-line', label: 'Line' },
  { tool: 'arrow', icon: 'arrow-top-right', label: 'Arrow' },
  { tool: 'rect', icon: 'square-outline', label: 'Rectangle' },
  { tool: 'ellipse', icon: 'circle-outline', label: 'Ellipse' },
  { tool: 'math', icon: 'sigma', label: 'Math', hostOnly: true },
  { tool: 'eraser', icon: 'eraser', label: 'Eraser' },
];

const uid = () => Math.random().toString(36).slice(2, 10);

/* ---------- Board state: ordered strokes, immutable per stroke so memo works ---------- */

function useBoard() {
  const strokes = useRef(new Map<string, Stroke>());
  const [, bump] = useReducer((x: number) => x + 1, 0);

  const apply = useCallback((m: WbMessage) => {
    const map = strokes.current;
    switch (m.t) {
      case 'b':
        map.set(m.id, { id: m.id, kind: m.k, color: m.c, width: m.w, points: m.p, text: m.x });
        break;
      case 'e': {
        // A shape keeps its start corner; only the dragged end moves.
        const s = map.get(m.id);
        if (s) map.set(m.id, { ...s, points: [s.points[0]!, s.points[1]!, ...m.p] });
        break;
      }
      case 'a': {
        const s = map.get(m.id);
        if (s) map.set(m.id, { ...s, points: s.points.concat(m.p) });
        break;
      }
      case 'u':
        map.delete(m.id);
        break;
      case 'c':
        map.clear();
        break;
      case 's':
        map.clear();
        m.strokes.forEach((s) => map.set(s.id, s));
        break;
      default:
        return;
    }
    bump();
  }, []);

  return { strokes, apply };
}

const MathItem = memo(function MathItem({ stroke, w, h }: { stroke: Stroke; w: number; h: number }) {
  const svg = useMemo(() => {
    try {
      return mathGroup(renderTex(stroke.text ?? ''), stroke.color, stroke.points[0]! * w, stroke.points[1]! * h, stroke.width * w);
    } catch {
      return null;
    }
  }, [stroke, w, h]);
  return svg ? <g dangerouslySetInnerHTML={{ __html: svg }} /> : null;
});

const StrokePath = memo(function StrokePath({ stroke, w, h }: { stroke: Stroke; w: number; h: number }) {
  if (stroke.kind === 'math') return <MathItem stroke={stroke} w={w} h={h} />;
  return (
    <path d={strokePath(stroke, w, h)} stroke={stroke.color} strokeWidth={strokePx(stroke.width, w)} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  );
});

const toolStyle = (active?: boolean): React.CSSProperties => ({
  flexShrink: 1, width: 40, minWidth: 30, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
  backgroundColor: active ? colors.primary : 'transparent',
});

function ToolButton({ icon, mcIcon, active, onPress, danger, label }: {
  icon?: IconName; mcIcon?: MdiName; active?: boolean; onPress: () => void; danger?: boolean; label: string;
}) {
  const tint = active ? '#fff' : danger ? colors.danger : colors.stageText;
  return (
    <Pressable onClick={onPress} scaleTo={0.85} style={toolStyle(active)} aria-label={label} title={label} aria-pressed={!!active}>
      {mcIcon ? <McIcon name={mcIcon} size={19} color={tint} /> : <Icon name={icon!} size={18} color={tint} />}
    </Pressable>
  );
}

function Swatch({ color, selected, onPress }: { color: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onClick={onPress} scaleTo={0.85} aria-label={`Colour ${color}`} aria-pressed={selected}
      style={{ position: 'relative', flexShrink: 1, width: 36, minWidth: 28, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{
        position: 'absolute', width: 34, height: 34, borderRadius: 17, border: `2px solid ${color}`,
        transform: `scale(${selected ? 1 : 0.75})`, opacity: selected ? 1 : 0.35, transition: 'all 300ms var(--spring)',
      }} />
      <span style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: color, border: '1px solid rgba(255,255,255,0.3)' }} />
    </Pressable>
  );
}

function ExportButton({ icon, label, busy, onPress }: { icon: IconName; label: string; busy: boolean; onPress: () => void }) {
  return (
    <Pressable onClick={onPress} disabled={busy} scaleTo={0.95}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.stageLine, padding: '8px 14px', borderRadius: radius.pill, minWidth: 84 }}>
      {busy ? <Spinner color={colors.stageText} size={16} /> : <Icon name={icon} size={16} color={colors.stageText} />}
      <Text variant="small" color={colors.stageText}>{label}</Text>
    </Pressable>
  );
}

const Divider = ({ vertical }: { vertical?: boolean }) => (
  <div style={vertical ? { height: 1, margin: '2px 4px', backgroundColor: colors.stageLine } : { height: 1, backgroundColor: colors.stageLine }} />
);

/** Two columns of 40px buttons, for the desktop tool rail. */
const railGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, 40px)', gap: 4, justifyItems: 'center' };

export function Whiteboard({ transport, isHost, title, rail }: {
  transport: WbTransport; isHost: boolean; title: string;
  /** Desktop: the tools stand in a column on the board's left instead of a panel under it. */
  rail?: boolean;
}) {
  const { strokes, apply } = useBoard();
  const [allowStudents, setAllowStudents] = useState(false);
  const [color, setColor] = useState(PALETTE[0]!);
  const [size, setSize] = useState(SIZES[1]!);
  const [tool, setTool] = useState<Tool>('pen');
  const eraser = tool === 'eraser';
  /** Where the teacher clicked with the math tool — the expression goes there. */
  const [mathAt, setMathAt] = useState<{ x: number; y: number } | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<BoardExportFormat | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);

  const canDraw = isHost || allowStudents;
  const mine = useRef<string[]>([]);
  const current = useRef<string | null>(null);
  const pending = useRef<number[]>([]);
  /** Latest end corner of the shape being dragged, not yet sent. */
  const pendingEnd = useRef<number[] | null>(null);
  const tapStart = useRef<number[] | null>(null);
  const drawing = useRef(false);
  const allowRef = useRef(allowStudents);
  useEffect(() => {
    allowRef.current = allowStudents;
  }, [allowStudents]);

  // Fit the 4:3 board inside the space it's given.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = Math.min(el.clientWidth, el.clientHeight * BOARD_RATIO);
      setBox({ w, h: w / BOARD_RATIO });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Incoming messages + late-join sync.
  useEffect(() => {
    const off = transport.subscribe((m) => {
      if (m.t === 'r' && isHost) {
        transport.send({ t: 's', strokes: [...strokes.current.values()], allow: allowRef.current });
        return;
      }
      if (m.t === 'p') return setAllowStudents(m.allow);
      if (m.t === 's') setAllowStudents(m.allow);
      apply(m);
    });
    if (!isHost) transport.send({ t: 'r' });
    return off;
  }, [transport, isHost, apply, strokes]);

  // Batch outgoing points so we don't flood the data channel.
  useEffect(() => {
    const timer = setInterval(() => {
      if (current.current && pending.current.length) {
        transport.send({ t: 'a', id: current.current, p: pending.current });
        pending.current = [];
      }
      // Shapes only need their latest end corner, however many moves happened.
      if (current.current && pendingEnd.current) {
        transport.send({ t: 'e', id: current.current, p: pendingEnd.current });
        pendingEnd.current = null;
      }
    }, FLUSH_MS);
    return () => clearInterval(timer);
  }, [transport]);

  const norm = (e: PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return [q(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))), q(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)))];
  };

  const add = (msg: Extract<WbMessage, { t: 'b' }>) => {
    mine.current.push(msg.id);
    apply(msg);
    transport.send(msg);
  };

  const remove = (id: string) => {
    mine.current = mine.current.filter((x) => x !== id);
    const m: WbMessage = { t: 'u', id };
    apply(m);
    transport.send(m);
  };

  const begin = (e: PointerEvent) => {
    if (!canDraw || !e.isPrimary) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drawing.current = true;
    const p = norm(e);
    if (tool === 'math') {
      tapStart.current = p;
      return;
    }
    const id = uid();
    current.current = id;
    pending.current = [];
    pendingEnd.current = null;
    if (isShape(tool)) add({ t: 'b', id, k: tool, c: color, w: size, p: [...p, ...p] });
    else add({ t: 'b', id, c: eraser ? BOARD_BG : color, w: eraser ? ERASER_WIDTH : size, p });
  };

  const move = (e: PointerEvent) => {
    const id = current.current;
    if (!drawing.current || !id || !e.isPrimary) return;
    const p = norm(e);
    if (isShape(tool)) {
      pendingEnd.current = p;
      apply({ t: 'e', id, p });
    } else {
      pending.current.push(...p);
      apply({ t: 'a', id, p });
    }
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (tool === 'math') {
      if (tapStart.current) setMathAt({ x: tapStart.current[0]!, y: tapStart.current[1]! });
      tapStart.current = null;
      return;
    }
    const id = current.current;
    current.current = null;
    if (!id) return;
    if (isShape(tool)) {
      const s = strokes.current.get(id);
      const [x0, y0, x1, y1] = s?.points ?? [];
      if (s && Math.hypot(x1! - x0!, y1! - y0!) < MIN_SHAPE) remove(id);
      else if (pendingEnd.current) transport.send({ t: 'e', id, p: pendingEnd.current });
      pendingEnd.current = null;
      return;
    }
    if (pending.current.length) transport.send({ t: 'a', id, p: pending.current });
    pending.current = [];
  };

  const insertMath = (tex: string, fontSize: number) => {
    const at = mathAt;
    setMathAt(null);
    if (!at) return;
    // Keep the whole expression on the board when it's placed near an edge.
    const { width, height } = mathSize(renderTex(tex), fontSize);
    const x = q(Math.max(0, Math.min(at.x, 1 - width)));
    const y = q(Math.max(0, Math.min(at.y, 1 - height * BOARD_RATIO)));
    add({ t: 'b', id: uid(), k: 'math', x: tex, c: color, w: fontSize, p: [x, y] });
    setTool('pen');
  };

  const undo = useCallback(() => {
    // Pop own strokes that still exist (another peer may have cleared the board).
    while (mine.current.length) {
      const id = mine.current.pop()!;
      if (strokes.current.has(id)) {
        const m: WbMessage = { t: 'u', id };
        apply(m);
        transport.send(m);
        return;
      }
    }
  }, [apply, strokes, transport]);

  // Ctrl/⌘+Z undoes your last stroke.
  useEffect(() => {
    if (!canDraw) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canDraw, undo]);

  const clear = () => {
    const m: WbMessage = { t: 'c' };
    apply(m);
    transport.send(m);
    mine.current = [];
  };

  const runExport = async (format: BoardExportFormat) => {
    if (exporting) return;
    setExporting(format);
    try {
      await exportBoard([...strokes.current.values()], format, title);
      setExportOpen(false);
    } catch (e) {
      alert('Export failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setExporting(null);
    }
  };

  const toggleStudents = () => {
    const next = !allowStudents;
    setAllowStudents(next);
    transport.send({ t: 'p', allow: next });
  };

  const cursor = !canDraw ? 'default' : tool === 'math' ? 'text' : eraser ? 'cell' : 'crosshair';

  const tools = (
    <>
      {TOOLS.filter((t) => isHost || !t.hostOnly).map((t) => (
        <ToolButton key={t.tool} mcIcon={t.icon} label={t.label} active={tool === t.tool} onPress={() => setTool(t.tool)} />
      ))}
      <ToolButton icon="arrow-undo" label="Undo (Ctrl+Z)" onPress={undo} />
    </>
  );
  const paints = (
    <>
      {PALETTE.map((c) => (
        <Swatch key={c} color={c} selected={!eraser && c === color} onPress={() => { setColor(c); if (eraser) setTool('pen'); }} />
      ))}
      {SIZES.map((s) => (
        <Pressable key={s} onClick={() => { setSize(s); if (eraser) setTool('pen'); }} scaleTo={0.85} style={toolStyle(!eraser && size === s)}
          aria-label="Line width" title="Line width">
          <span style={{ width: 4 + s * 600, height: 4 + s * 600, borderRadius: 20, backgroundColor: !eraser && size === s ? '#fff' : colors.stageText }} />
        </Pressable>
      ))}
    </>
  );
  const hostTools = (
    <>
      <ToolButton icon="trash-outline" label="Clear board" danger onPress={clear} />
      <ToolButton icon={allowStudents ? 'people' : 'people-outline'} label="Students can draw" active={allowStudents} onPress={toggleStudents} />
      <ToolButton icon="share-outline" label="Export board" active={exportOpen} onPress={() => setExportOpen((x) => !x)} />
    </>
  );
  const exportRow = (
    <>
      <ExportButton icon="image-outline" label="Image" busy={exporting === 'png'} onPress={() => runExport('png')} />
      <ExportButton icon="document-outline" label="PDF" busy={exporting === 'pdf'} onPress={() => runExport('pdf')} />
    </>
  );
  const hint = !isHost ? null : tool === 'math' ? 'Click the board where the expression goes' : isShape(tool) ? 'Drag to draw the shape' : null;

  return (
    <div className={rail ? 'h' : 'v'} style={{ flex: 1, gap: 12, minHeight: 0, minWidth: 0, alignItems: 'stretch' }}>
      {rail && canDraw && (
        <div className="a-fade" style={{ position: 'relative', zIndex: 2, alignSelf: 'center', maxHeight: '100%', display: 'flex' }}>
          <div className="v stage-card stage-scroll" style={{ padding: 6, gap: 6, overflowY: 'auto' }}>
            <div style={railGrid}>{tools}</div>
            <Divider vertical />
            <div style={railGrid}>{paints}</div>
            {isHost && (
              <>
                <Divider vertical />
                <div style={railGrid}>{hostTools}</div>
              </>
            )}
          </div>
          {isHost && exportOpen && (
            <div className="v a-fade stage-card" style={{ position: 'absolute', left: 'calc(100% + 8px)', bottom: 0, zIndex: 3, padding: 10, gap: 8, width: 'max-content' }}>
              <Text variant="small" color={colors.stageMuted}>Export board</Text>
              <div className="h" style={{ gap: 8 }}>{exportRow}</div>
            </div>
          )}
        </div>
      )}

      <div ref={area} className="v center" style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
        {box.w > 0 && (
          <div className="a-fade" style={{ position: 'relative', width: box.w, height: box.h, backgroundColor: BOARD_BG, borderRadius: radius.lg, overflow: 'hidden' }}>
            <svg
              ref={svg}
              width={box.w}
              height={box.h}
              viewBox={`0 0 ${box.w} ${box.h}`}
              onPointerDown={begin}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              style={{ display: 'block', touchAction: 'none', cursor }}
            >
              {[...strokes.current.values()].map((s) => <StrokePath key={s.id} stroke={s} w={box.w} h={box.h} />)}
            </svg>
            {!canDraw && (
              <div className="h" style={{ position: 'absolute', top: 10, right: 10, gap: 4, backgroundColor: colors.bg, padding: '4px 8px', borderRadius: radius.pill, pointerEvents: 'none' }}>
                <Icon name="eye-outline" size={12} color={colors.muted} />
                <Text variant="small" color={colors.muted} style={{ fontSize: 11 }}>View only</Text>
              </div>
            )}
            {rail && hint && (
              <div key={hint} className="a-fade" style={{
                position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(22,23,28,0.82)',
                padding: '5px 12px', borderRadius: radius.pill, pointerEvents: 'none', whiteSpace: 'nowrap',
              }}>
                <Text variant="small" color="#fff" style={{ fontSize: 12 }}>{hint}</Text>
              </div>
            )}
          </div>
        )}
      </div>

      {!rail && canDraw && (
        <div className="v a-down stage-card" style={{ padding: 8, gap: 8, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
          <div className="h" style={{ justifyContent: 'space-between', gap: 4 }}>{tools}</div>
          <Divider />
          <div className="h" style={{ justifyContent: 'space-between', gap: 4 }}>{paints}</div>
          {isHost && (
            <>
              <Divider />
              <div className="h" style={{ gap: 4 }}>
                {hostTools}
                <Text variant="small" color={colors.stageMuted} lines={1} className="flex1" style={{ textAlign: 'right', paddingRight: 6, fontSize: 11 }}>
                  {hint ?? ' '}
                </Text>
              </div>
            </>
          )}
          {isHost && exportOpen && (
            <div className="h a-down" style={{ gap: 8, padding: '2px 6px 0' }}>
              <Text variant="small" color={colors.stageMuted} className="flex1">Export board</Text>
              {exportRow}
            </div>
          )}
        </div>
      )}

      <MathComposer visible={!!mathAt} color={color} onCancel={() => setMathAt(null)} onInsert={insertMath} />
    </div>
  );
}
