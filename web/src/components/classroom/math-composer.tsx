import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChoiceRow } from '@/components/ui/choice';
import { Icon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { MATH_SNIPPETS, mathDocument, mathSize, renderTex, type MathSvg } from '@/lib/math';
import { colors, radius } from '@/theme';

/** Math font sizes, as a fraction of board width. */
export const MATH_SIZES = [
  { value: 0.035, label: 'Small' },
  { value: 0.05, label: 'Medium' },
  { value: 0.075, label: 'Large' },
];

function tryRender(tex: string): { math: MathSvg | null; error: string | null } {
  if (!tex.trim()) return { math: null, error: null };
  try {
    return { math: renderTex(tex), error: null };
  } catch (e) {
    return { math: null, error: e instanceof Error ? e.message : 'Check the expression' };
  }
}

const PREVIEW_H = 120;

function Preview({ math, color }: { math: MathSvg; color: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Fit the expression inside the preview box, never larger than 40px per em.
  const fontPx = w ? Math.min(40, ((w - 24) * 1000) / math.vb[2], ((PREVIEW_H - 24) * 1000) / math.vb[3]) : 0;
  const size = mathSize(math, fontPx);
  return (
    <div ref={box} className="v center" style={{ height: PREVIEW_H, borderRadius: radius.lg, backgroundColor: '#fff', overflow: 'hidden' }}>
      {w > 0 && <span style={{ lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: mathDocument(math, color, size.width, size.height) }} />}
    </div>
  );
}

export function MathComposer({ visible, color, onCancel, onInsert }: {
  visible: boolean;
  color: string;
  onCancel: () => void;
  onInsert: (tex: string, size: number) => void;
}) {
  const [tex, setTex] = useState('');
  const [size, setSize] = useState(MATH_SIZES[1]!.value);
  const { math, error } = useMemo(() => tryRender(tex), [tex]);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!visible) return null;

  function insert(snippet: string) {
    const el = input.current;
    const start = el?.selectionStart ?? tex.length;
    const end = el?.selectionEnd ?? tex.length;
    const cursor = snippet.indexOf('|');
    const clean = snippet.replace('|', '');
    const at = start + (cursor >= 0 ? cursor : clean.length);
    setTex(tex.slice(0, start) + clean + tex.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at, at);
    });
  }

  function close(done: boolean) {
    if (done && math) onInsert(tex.trim(), size);
    else onCancel();
    setTex('');
  }

  // Portalled to <body>: the board's entrance animation makes its own stacking context.
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }}>
      <div className="a-fade" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)' }} onClick={() => close(false)} />
      <div className="v" role="dialog" aria-label="Math expression" style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, margin: '0 auto', maxWidth: 640, backgroundColor: '#15161B',
        borderRadius: `${radius.xl}px ${radius.xl}px 0 0`, padding: '18px 16px max(env(safe-area-inset-bottom), 16px)', gap: 12,
        border: `1px solid ${colors.stageLine}`, borderBottom: 0, animation: 'slideUp 250ms ease both',
      }}>
        <div className="h" style={{ gap: 12 }}>
          <div className="v flex1">
            <Text variant="heading" color={colors.stageText}>Math expression</Text>
            <Text variant="small" color={colors.stageMuted}>Type LaTeX, or use the buttons below</Text>
          </div>
          <Pressable scaleTo={0.9} onClick={() => close(false)} aria-label="Cancel"
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.stageCard, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={18} color={colors.stageText} />
          </Pressable>
        </div>

        {math ? (
          <Preview math={math} color={color} />
        ) : (
          <div className="v center" style={{ height: PREVIEW_H, borderRadius: radius.lg, backgroundColor: '#fff', padding: 16 }}>
            <Text variant="small" color={error ? colors.danger : colors.muted} style={{ textAlign: 'center' }}>{error ?? 'Your expression will appear here'}</Text>
          </div>
        )}

        <textarea
          ref={input}
          value={tex}
          onChange={(e) => setTex(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) close(true); }}
          placeholder={String.raw`e.g. \frac{-b \pm \sqrt{b^2-4ac}}{2a}`}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          rows={2}
          style={{
            minHeight: 52, maxHeight: 110, borderRadius: radius.md, backgroundColor: colors.stageCard, color: colors.stageText,
            padding: '12px 14px', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 15, border: 0, outline: 0, resize: 'vertical',
          }}
        />

        <div className="hscroll" style={{ gap: 6, margin: 0, padding: 0 }}>
          {MATH_SNIPPETS.map((s) => (
            <Pressable key={s.label} scaleTo={0.88} onClick={() => insert(s.tex)}
              style={{ minWidth: 44, height: 40, padding: '0 10px', borderRadius: radius.sm, backgroundColor: colors.stageCard, border: `1px solid ${colors.stageLine}`, flexShrink: 0 }}>
              <Text variant="bodyStrong" color={colors.stageText}>{s.label}</Text>
            </Pressable>
          ))}
        </div>

        <div className="h" style={{ gap: 10 }}>
          <div className="flex1"><ChoiceRow wrap options={MATH_SIZES} value={size} onChange={setSize} accent={colors.primary} /></div>
          <Pressable scaleTo={0.94} disabled={!math} onClick={() => close(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 46, padding: '0 18px', borderRadius: radius.md, backgroundColor: colors.primary }}>
            <Icon name="checkmark" size={18} color="#fff" />
            <Text variant="bodyStrong" color="#fff">Insert</Text>
          </Pressable>
        </div>
      </div>
    </div>,
    document.body,
  );
}
