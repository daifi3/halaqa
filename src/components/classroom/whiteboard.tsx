import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Canvas, Path } from '@shopify/react-native-skia';
import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useDerivedValue, withSpring } from 'react-native-reanimated';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { exportBoard, type BoardExportFormat } from '@/lib/export-board';
import { mathSize, renderTex } from '@/lib/math';
import { useSkiaReady } from '@/lib/skia-ready';
import {
  BOARD_BG, BOARD_RATIO, isShape, q, strokePath, strokePx, type ShapeKind, type Stroke, type WbMessage, type WbTransport,
} from '@/lib/whiteboard';
import { MathComposer, MathImage } from './math-composer';
import { colors, radius, springs } from '@/theme';

const PALETTE = ['#16171C', '#4B44E0', '#E5484D', '#1F9D6B', '#E0A23C'];
const SIZES = [0.004, 0.008, 0.016];
const ERASER_WIDTH = 0.045;
const FLUSH_MS = 40;
/** A shape dragged shorter than this (fraction of the board) was a stray tap — drop it. */
const MIN_SHAPE = 0.012;

type Tool = 'pen' | ShapeKind | 'math' | 'eraser';
type McIcon = keyof typeof MaterialCommunityIcons.glyphMap;

const TOOLS: { tool: Tool; icon: McIcon; label: string; hostOnly?: boolean }[] = [
  { tool: 'pen', icon: 'pencil', label: 'Pen' },
  { tool: 'line', icon: 'vector-line', label: 'Line' },
  { tool: 'arrow', icon: 'arrow-top-right', label: 'Arrow' },
  { tool: 'rect', icon: 'square-outline', label: 'Rectangle' },
  { tool: 'ellipse', icon: 'circle-outline', label: 'Ellipse' },
  { tool: 'math', icon: 'sigma', label: 'Math', hostOnly: true },
  { tool: 'eraser', icon: 'eraser', label: 'Eraser' },
];

const uid = () => Math.random().toString(36).slice(2, 10);

/* ------------------------------------------------------------------ */
/* Board state: ordered strokes, immutable per stroke so memo works   */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */

const MathItem = memo(function MathItem({ stroke, w, h }: { stroke: Stroke; w: number; h: number }) {
  const math = useMemo(() => {
    try {
      return renderTex(stroke.text ?? '');
    } catch {
      return null;
    }
  }, [stroke.text]);
  if (!math) return null;
  return <MathImage math={math} color={stroke.color} x={stroke.points[0]! * w} y={stroke.points[1]! * h} fontPx={stroke.width * w} />;
});

const StrokePath = memo(function StrokePath({ stroke, w, h }: { stroke: Stroke; w: number; h: number }) {
  if (stroke.kind === 'math') return <MathItem stroke={stroke} w={w} h={h} />;
  return (
    <Path
      path={strokePath(stroke, w, h)}
      color={stroke.color}
      style="stroke"
      strokeWidth={strokePx(stroke.width, w)}
      strokeCap="round"
      strokeJoin="round"
    />
  );
});

function Swatch({ color, selected, onPress }: { color: string; selected: boolean; onPress: () => void }) {
  const p = useDerivedValue(() => withSpring(selected ? 1 : 0, springs.bouncy));
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: 0.75 + p.value * 0.25 }], opacity: 0.35 + p.value * 0.65 }));
  return (
    <PressableScale onPress={onPress} scaleTo={0.85} style={styles.swatchHit}>
      <Animated.View style={[styles.swatchRing, { borderColor: color }, ring]} />
      <View style={[styles.swatch, { backgroundColor: color }]} />
    </PressableScale>
  );
}

function ToolButton({ icon, mcIcon, active, onPress, danger, label }: {
  icon?: keyof typeof Ionicons.glyphMap; mcIcon?: McIcon; active?: boolean; onPress: () => void; danger?: boolean; label: string;
}) {
  const tint = active ? '#fff' : danger ? colors.danger : colors.stageText;
  return (
    <PressableScale onPress={onPress} scaleTo={0.85} style={[styles.tool, active && styles.toolActive]} accessibilityLabel={label} accessibilityState={{ selected: !!active }}>
      {mcIcon ? <MaterialCommunityIcons name={mcIcon} size={19} color={tint} /> : <Ionicons name={icon!} size={18} color={tint} />}
    </PressableScale>
  );
}

/* ------------------------------------------------------------------ */

function ExportButton({ icon, label, busy, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; busy: boolean; onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} disabled={busy} scaleTo={0.95} style={styles.exportBtn}>
      {busy ? <ActivityIndicator size="small" color={colors.stageText} /> : <Ionicons name={icon} size={16} color={colors.stageText} />}
      <Text variant="small" color={colors.stageText}>{label}</Text>
    </PressableScale>
  );
}

/* ------------------------------------------------------------------ */

export function Whiteboard({ transport, isHost, title }: { transport: WbTransport; isHost: boolean; title: string }) {
  const { strokes, apply } = useBoard();
  const [allowStudents, setAllowStudents] = useState(false);
  const [color, setColor] = useState(PALETTE[0]!);
  const [size, setSize] = useState(SIZES[1]!);
  const [tool, setTool] = useState<Tool>('pen');
  const eraser = tool === 'eraser';
  /** Where the teacher tapped with the math tool — the expression goes there. */
  const [mathAt, setMathAt] = useState<{ x: number; y: number } | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<BoardExportFormat | null>(null);

  const canDraw = isHost || allowStudents;
  const mine = useRef<string[]>([]);
  const current = useRef<string | null>(null);
  const pending = useRef<number[]>([]);
  /** Latest end corner of the shape being dragged, not yet sent. */
  const pendingEnd = useRef<number[] | null>(null);
  const tapStart = useRef<number[] | null>(null);
  const allowRef = useRef(allowStudents);
  useEffect(() => {
    allowRef.current = allowStudents;
  }, [allowStudents]);

  const skiaReady = useSkiaReady();

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

  const norm = (x: number, y: number) => [q(Math.min(1, Math.max(0, x / box.w))), q(Math.min(1, Math.max(0, y / box.h)))];

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

  const begin = (x: number, y: number) => {
    const p = norm(x, y);
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

  const move = (x: number, y: number) => {
    const id = current.current;
    if (!id) return;
    const p = norm(x, y);
    if (isShape(tool)) {
      pendingEnd.current = p;
      apply({ t: 'e', id, p });
    } else {
      pending.current.push(...p);
      apply({ t: 'a', id, p });
    }
  };

  const end = () => {
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

  const pan = usePanGesture({
    runOnJS: true,
    enabled: canDraw && box.w > 0,
    minDistance: 0,
    maxPointers: 1,
    onBegin: (e) => begin(e.x, e.y),
    onUpdate: (e) => move(e.x, e.y),
    onFinalize: () => end(),
  });

  const undo = () => {
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
  };

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
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setExporting(null);
    }
  };

  const toggleStudents = () => {
    const next = !allowStudents;
    setAllowStudents(next);
    transport.send({ t: 'p', allow: next });
  };

  return (
    <View style={{ flex: 1, gap: 12 }}>
      <View
        style={styles.area}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          const w = Math.min(width, height * BOARD_RATIO);
          setBox({ w, h: w / BOARD_RATIO });
        }}
      >
        {box.w > 0 && (
          <Animated.View entering={FadeIn.duration(250)} style={[styles.board, { width: box.w, height: box.h }]}>
            {skiaReady ? (
              <GestureDetector gesture={pan}>
                <View style={StyleSheet.absoluteFill}>
                  <Canvas style={StyleSheet.absoluteFill}>
                    {[...strokes.current.values()].map((s) => (
                      <StrokePath key={s.id} stroke={s} w={box.w} h={box.h} />
                    ))}
                  </Canvas>
                </View>
              </GestureDetector>
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.loading]}>
                <ActivityIndicator color={colors.stageMuted} />
              </View>
            )}
            {!canDraw && skiaReady && (
              <View style={styles.viewOnly} pointerEvents="none">
                <Ionicons name="eye-outline" size={12} color={colors.muted} />
                <Text variant="small" color={colors.muted} style={{ fontSize: 11 }}>View only</Text>
              </View>
            )}
          </Animated.View>
        )}
      </View>

      {canDraw && (
        <Animated.View entering={FadeInDown} style={styles.toolbar}>
          <View style={styles.group}>
            {TOOLS.filter((t) => isHost || !t.hostOnly).map((t) => (
              <ToolButton key={t.tool} mcIcon={t.icon} label={t.label} active={tool === t.tool} onPress={() => setTool(t.tool)} />
            ))}
            <ToolButton icon="arrow-undo" label="Undo" onPress={undo} />
          </View>
          <View style={styles.divider} />
          <View style={styles.group}>
            {PALETTE.map((c) => (
              <Swatch key={c} color={c} selected={!eraser && c === color} onPress={() => { setColor(c); if (eraser) setTool('pen'); }} />
            ))}
            {SIZES.map((s) => (
              <PressableScale key={s} onPress={() => { setSize(s); if (eraser) setTool('pen'); }} scaleTo={0.85} style={[styles.tool, !eraser && size === s && styles.toolActive]} accessibilityLabel="Line width">
                <View style={{ width: 4 + s * 600, height: 4 + s * 600, borderRadius: 20, backgroundColor: !eraser && size === s ? '#fff' : colors.stageText }} />
              </PressableScale>
            ))}
          </View>
          {isHost && (
            <>
              <View style={styles.divider} />
              <View style={styles.group}>
                <ToolButton icon="trash-outline" label="Clear board" danger onPress={clear} />
                <ToolButton icon={allowStudents ? 'people' : 'people-outline'} label="Students can draw" active={allowStudents} onPress={toggleStudents} />
                <ToolButton icon="share-outline" label="Export board" active={exportOpen} onPress={() => setExportOpen((x) => !x)} />
                <Text variant="small" color={colors.stageMuted} style={styles.hint} numberOfLines={1}>
                  {tool === 'math' ? 'Tap the board where the expression goes' : isShape(tool) ? 'Drag to draw the shape' : ' '}
                </Text>
              </View>
            </>
          )}
          {isHost && exportOpen && (
            <Animated.View entering={FadeInDown.duration(180)} style={styles.exportRow}>
              <Text variant="small" color={colors.stageMuted} style={{ flex: 1 }}>Export board</Text>
              <ExportButton icon="image-outline" label="Image" busy={exporting === 'png'} onPress={() => runExport('png')} />
              <ExportButton icon="document-outline" label="PDF" busy={exporting === 'pdf'} onPress={() => runExport('pdf')} />
            </Animated.View>
          )}
        </Animated.View>
      )}

      <MathComposer visible={!!mathAt} color={color} onCancel={() => setMathAt(null)} onInsert={insertMath} />
    </View>
  );
}

const styles = StyleSheet.create({
  area: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  board: { backgroundColor: BOARD_BG, borderRadius: radius.lg, overflow: 'hidden' },
  loading: { alignItems: 'center', justifyContent: 'center' },
  viewOnly: {
    position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill,
  },
  toolbar: {
    backgroundColor: colors.stageCard, borderRadius: radius.lg, padding: 8, gap: 8,
    borderWidth: 1, borderColor: colors.stageLine,
  },
  group: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  divider: { height: 1, backgroundColor: colors.stageLine },
  swatchHit: { flexShrink: 1, width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  swatchRing: { position: 'absolute', width: 34, height: 34, borderRadius: 17, borderWidth: 2 },
  swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  // Shrinks below 40 on narrow phones so the full host toolbar still fits on one row.
  tool: { flexShrink: 1, width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toolActive: { backgroundColor: colors.primary },
  hint: { flex: 1, textAlign: 'right', paddingRight: 6, fontSize: 11 },
  exportRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingTop: 2 },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.stageLine,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, minWidth: 84, justifyContent: 'center',
  },
});
