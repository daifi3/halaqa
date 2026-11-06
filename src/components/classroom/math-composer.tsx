import Ionicons from '@expo/vector-icons/Ionicons';
import { Canvas, ImageSVG, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChoiceRow } from '@/components/ui/choice';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { MATH_SNIPPETS, mathDocument, mathSize, renderTex, type MathSvg } from '@/lib/math';
import { colors, radius } from '@/theme';

/** Math font sizes, as a fraction of board width. */
export const MATH_SIZES = [
  { value: 0.035, label: 'Small' },
  { value: 0.05, label: 'Medium' },
  { value: 0.075, label: 'Large' },
];

/** Parses `svg` once per expression/colour/size and draws it — shared by the board and the preview. */
export function MathImage({ math, color, x, y, fontPx }: { math: MathSvg; color: string; x: number; y: number; fontPx: number }) {
  const { width, height } = mathSize(math, fontPx);
  const svg = useMemo(
    () => Skia.SVG.MakeFromString(mathDocument(math, color, width, height)),
    [math, color, width, height],
  );
  return <ImageSVG svg={svg} x={x} y={y} width={width} height={height} />;
}

function tryRender(tex: string): { math: MathSvg | null; error: string | null } {
  if (!tex.trim()) return { math: null, error: null };
  try {
    return { math: renderTex(tex), error: null };
  } catch (e) {
    return { math: null, error: e instanceof Error ? e.message : 'Check the expression' };
  }
}

const PREVIEW_H = 120;
/** Smaller preview while the keyboard is up, so the whole sheet fits above it on small phones. */
const PREVIEW_H_TYPING = 84;

function Preview({ math, color, height }: { math: MathSvg; color: string; height: number }) {
  const [w, setW] = useState(0);
  // Fit the expression inside the preview box, never larger than 40px per em.
  const fontPx = w ? Math.min(40, ((w - 24) * 1000) / math.vb[2], ((height - 24) * 1000) / math.vb[3]) : 0;
  const size = mathSize(math, fontPx);
  return (
    <View style={[styles.preview, { height }]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Canvas style={StyleSheet.absoluteFill}>
          <MathImage math={math} color={color} fontPx={fontPx} x={(w - size.width) / 2} y={(height - size.height) / 2} />
        </Canvas>
      )}
    </View>
  );
}

/**
 * How far the keyboard overlaps `container`. Android runs edge-to-edge, so the
 * window doesn't shrink for the keyboard; where it does (or on iOS with an inset
 * already applied) the overlap is simply 0. Measuring the real overlap, rather
 * than adding the keyboard height, can't push the sheet up twice.
 */
type ViewRef = React.ComponentRef<typeof View>;

function useKeyboardOverlap(container: React.RefObject<ViewRef | null>) {
  const [overlap, setOverlap] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      const top = e.endCoordinates.screenY;
      container.current?.measureInWindow((_x, y, _w, h) => setOverlap(Math.max(0, y + h - top)));
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setOverlap(0));
    return () => { show.remove(); hide.remove(); };
  }, [container]);
  return overlap;
}

export function MathComposer({ visible, color, onCancel, onInsert }: {
  visible: boolean;
  color: string;
  onCancel: () => void;
  onInsert: (tex: string, size: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const [tex, setTex] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [size, setSize] = useState(MATH_SIZES[1]!.value);
  const { math, error } = useMemo(() => tryRender(tex), [tex]);
  const container = useRef<ViewRef>(null);
  const keyboard = useKeyboardOverlap(container);
  const previewH = keyboard ? PREVIEW_H_TYPING : PREVIEW_H;

  function insert(snippet: string) {
    const cursor = snippet.indexOf('|');
    const clean = snippet.replace('|', '');
    const next = tex.slice(0, selection.start) + clean + tex.slice(selection.end);
    const at = selection.start + (cursor >= 0 ? cursor : clean.length);
    setTex(next);
    setSelection({ start: at, end: at });
  }

  function close(done: boolean) {
    if (done && math) onInsert(tex.trim(), size);
    else onCancel();
    setTex('');
    setSelection({ start: 0, end: 0 });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => close(false)}>
      <Pressable style={styles.backdrop} onPress={() => close(false)} accessibilityLabel="Cancel" />
      <View ref={container} style={styles.avoider} pointerEvents="box-none">
        {/* Sits on top of the keyboard when it's open, above the system bar otherwise. */}
        <View style={[styles.sheet, { paddingBottom: keyboard ? keyboard + 12 : Math.max(insets.bottom, 16) }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text variant="heading" color={colors.stageText}>Math expression</Text>
              <Text variant="small" color={colors.stageMuted}>Type LaTeX, or use the buttons below</Text>
            </View>
            <PressableScale scaleTo={0.9} onPress={() => close(false)} style={styles.close}>
              <Ionicons name="close" size={18} color={colors.stageText} />
            </PressableScale>
          </View>

          {math ? (
            <Preview math={math} color={color} height={previewH} />
          ) : (
            <View style={[styles.preview, styles.previewEmpty, { height: previewH }]}>
              <Text variant="small" color={error ? colors.danger : colors.muted} style={{ textAlign: 'center' }}>
                {error ?? 'Your expression will appear here'}
              </Text>
            </View>
          )}

          <TextInput
            value={tex}
            onChangeText={setTex}
            selection={selection}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
            placeholder={String.raw`e.g. \frac{-b \pm \sqrt{b^2-4ac}}{2a}`}
            placeholderTextColor={colors.stageMuted}
            selectionColor={colors.primary}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            multiline
            style={styles.input}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.snippets} keyboardShouldPersistTaps="always">
            {MATH_SNIPPETS.map((s) => (
              <PressableScale key={s.label} scaleTo={0.88} onPress={() => insert(s.tex)} style={styles.snippet}>
                <Text variant="bodyStrong" color={colors.stageText}>{s.label}</Text>
              </PressableScale>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <View style={{ flex: 1 }}>
              <ChoiceRow wrap options={MATH_SIZES} value={size} onChange={setSize} accent={colors.primary} />
            </View>
            <PressableScale scaleTo={0.94} disabled={!math} onPress={() => close(true)} style={styles.insert}>
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text variant="bodyStrong" color="#fff">Insert</Text>
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)' },
  avoider: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#15161B', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingTop: 18, paddingHorizontal: 16, gap: 12, borderWidth: 1, borderBottomWidth: 0, borderColor: colors.stageLine,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.stageCard, alignItems: 'center', justifyContent: 'center' },
  preview: { borderRadius: radius.lg, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  previewEmpty: { alignItems: 'center', justifyContent: 'center', padding: 16 },
  input: {
    minHeight: 52, maxHeight: 110, borderRadius: radius.md, backgroundColor: colors.stageCard, color: colors.stageText,
    paddingHorizontal: 14, paddingVertical: 12, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 15,
  },
  snippets: { gap: 6 },
  snippet: {
    minWidth: 44, height: 40, paddingHorizontal: 10, borderRadius: radius.sm, backgroundColor: colors.stageCard,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.stageLine,
  },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  insert: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 46, paddingHorizontal: 18, borderRadius: radius.md, backgroundColor: colors.primary },
});
