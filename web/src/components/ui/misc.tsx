import type { CSSProperties, ReactNode } from 'react';
import { initials } from '@/lib/format';
import type { Person } from '@/lib/types';
import { useSession } from '@/store/session';
import { colors, radius } from '@/theme';
import { Icon, type IconName } from './icon';
import { Pressable } from './pressable';
import { Text } from './text';

/* ---------- Avatar ---------- */

const AVATAR_TONES = ['#4B44E0', '#E0763C', '#1F9D6B', '#C2417E', '#2F80C2', '#8A5CF6'];
const toneFor = (name: string) => AVATAR_TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length]!;

export function Avatar({ name, size = 40, ring, uri }: { name: string; size?: number; ring?: string; uri?: string | null }) {
  const tone = toneFor(name);
  return (
    <span
      className="h center"
      style={{
        width: size, height: size, borderRadius: size / 2, backgroundColor: tone + '22', overflow: 'hidden', flexShrink: 0,
        border: ring ? `2px solid ${ring}` : undefined,
      }}
    >
      {uri ? (
        <img src={uri} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <Text variant="bodyStrong" color={tone} style={{ fontSize: size * 0.38, lineHeight: `${size * 0.48}px` }}>
          {initials(name)}
        </Text>
      )}
    </span>
  );
}

/**
 * Avatar for a person from server data. When it's the signed-in user, their name
 * and picture come from the session instead, so a new profile picture shows up on
 * every screen at once, without waiting for the next fetch.
 */
export function PersonAvatar({ person, size, ring }: { person: Person; size?: number; ring?: string }) {
  const me = useSession((s) => (s.user && s.user.id === person.id ? s.user : null));
  const shown = me ?? person;
  return <Avatar name={shown.name} size={size} ring={ring} uri={shown.avatarUrl} />;
}

/* ---------- Chip ---------- */

export function Chip({ label, color = colors.inkSoft, bg = colors.surfaceAlt, icon }: {
  label: string; color?: string; bg?: string; icon?: IconName;
}) {
  return (
    <span className="h" style={{ gap: 4, padding: '4px 10px', borderRadius: radius.pill, backgroundColor: bg, alignSelf: 'flex-start', flexShrink: 0 }}>
      {icon && <Icon name={icon} size={12} color={color} />}
      <Text variant="small" color={color} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{label}</Text>
    </span>
  );
}

/* ---------- Pulsing live dot ---------- */

export function PulseDot({ color = colors.danger, size = 8 }: { color?: string; size?: number }) {
  return (
    <span style={{ position: 'relative', width: size, height: size, flexShrink: 0, display: 'inline-block' }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: size, backgroundColor: color, animation: 'pulseHalo 1100ms ease-out infinite' }} />
      <span style={{ position: 'absolute', inset: 0, borderRadius: size, backgroundColor: color }} />
    </span>
  );
}

/* ---------- Icon button ---------- */

export function IconButton({
  icon, onPress, color = colors.ink, bg = colors.surface, size = 44, style, label, disabled,
}: {
  icon: IconName; onPress?: () => void; color?: string; bg?: string; size?: number; style?: CSSProperties; label?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onClick={onPress}
      scaleTo={0.9}
      aria-label={label ?? icon.replace(/-outline$/, '').replace(/-/g, ' ')}
      disabled={disabled}
      style={{
        width: size, height: size, borderRadius: size / 2, backgroundColor: bg, display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...style,
      }}
    >
      <Icon name={icon} size={size * 0.45} color={color} />
    </Pressable>
  );
}

/* ---------- Skeleton (shimmer placeholder) ---------- */

export function Skeleton({ height = 96, style }: { height?: number; style?: CSSProperties }) {
  return (
    <div style={{ height, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt, animation: 'shimmer 1400ms ease-in-out infinite', ...style }} />
  );
}

/* ---------- Switch & toggle row (icon + label + switch) ---------- */

export function Switch({ value, onChange, disabled, tint = colors.primary, label }: {
  value: boolean; onChange: (v: boolean) => void; disabled?: boolean; tint?: string; label?: string;
}) {
  return (
    <span className="switch">
      <input type="checkbox" role="switch" checked={value} disabled={disabled} aria-label={label} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" style={{ backgroundColor: value ? tint + '55' : colors.line }} />
      <span className="thumb" style={{ backgroundColor: value && !disabled ? tint : '#fff' }} />
    </span>
  );
}

export function ToggleRow({
  icon, title, body, value, onChange, disabled, tint = colors.primary,
}: {
  icon: IconName; title: string; body: string; value: boolean; onChange: (v: boolean) => void;
  disabled?: boolean; tint?: string;
}) {
  return (
    <div className="h" style={{ gap: 12, padding: '14px 0', opacity: disabled ? 0.4 : 1 }}>
      <span className="h center" style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: tint + '22', flexShrink: 0 }}>
        <Icon name={icon} size={18} color={tint} />
      </span>
      <div className="v flex1" style={{ gap: 2 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="small" color={colors.muted}>{body}</Text>
      </div>
      <Switch value={value} onChange={onChange} disabled={disabled} tint={tint} label={title} />
    </div>
  );
}

/* ---------- Empty state ---------- */

export function EmptyState({ icon, title, body, children }: {
  icon: IconName; title: string; body: string; children?: ReactNode;
}) {
  return (
    <div className="v a-fade" style={{ alignItems: 'center', gap: 10, padding: '48px 24px' }}>
      <span className="h center" style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: colors.primarySoft, marginBottom: 6 }}>
        <Icon name={icon} size={28} color={colors.primary} />
      </span>
      <Text variant="heading" style={{ textAlign: 'center' }}>{title}</Text>
      <Text color={colors.muted} style={{ textAlign: 'center', maxWidth: 280 }}>{body}</Text>
      {children}
    </div>
  );
}

/* ---------- Spinner ---------- */

export function Spinner({ color = colors.muted, size = 20 }: { color?: string; size?: number }) {
  return <span className="spinner" style={{ color, width: size, height: size }} />;
}

/** Delay helper for staggered entrance animations (Reanimated's `.delay(ms)`). */
export const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });
