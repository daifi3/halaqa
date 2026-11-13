import { colors, radius } from '@/theme';
import { Pressable } from './pressable';
import { Text } from './text';

function ChoicePill({ label, sub, selected, onPress, accent }: {
  label: string; sub?: string; selected: boolean; onPress: () => void; accent: string;
}) {
  return (
    <Pressable
      onClick={onPress}
      scaleTo={0.92}
      aria-pressed={selected}
      style={{
        padding: '10px 16px', borderRadius: radius.md, border: `1.5px solid ${selected ? accent : colors.line}`,
        backgroundColor: selected ? accent : colors.surface, display: 'flex', flexDirection: 'column', alignItems: 'center',
        minWidth: sub ? 64 : undefined, flexShrink: 0, whiteSpace: 'nowrap',
      }}
    >
      {sub && <Text variant="small" color={selected ? 'rgba(255,255,255,0.75)' : colors.muted}>{sub}</Text>}
      <Text variant="bodyStrong" color={selected ? '#fff' : colors.ink}>{label}</Text>
    </Pressable>
  );
}

/** Horizontal (or wrapping) row of selectable pills. */
export function ChoiceRow<T extends string | number>({
  options, value, onChange, accent = colors.primary, wrap,
}: {
  options: { value: T; label: string; sub?: string }[];
  value: T;
  onChange: (v: T) => void;
  accent?: string;
  wrap?: boolean;
}) {
  const items = options.map((o) => (
    <ChoicePill key={String(o.value)} label={o.label} sub={o.sub} selected={o.value === value} onPress={() => onChange(o.value)} accent={accent} />
  ));
  if (wrap) return <div className="h wrap" style={{ gap: 8 }}>{items}</div>;
  return <div className="hscroll">{items}</div>;
}
