import type { CSSProperties } from 'react';
import { colors, radius } from '@/theme';
import { Icon, type IconName } from './icon';
import { Pressable } from './pressable';
import { Text } from './text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.ink, fg: '#fff' },
  secondary: { bg: colors.surface, fg: colors.ink, border: colors.line },
  ghost: { bg: 'transparent', fg: colors.ink },
  danger: { bg: colors.danger, fg: '#fff' },
};

export function Button({
  title, onPress, variant = 'primary', icon, loading, disabled, accent, style, type = 'button', className, size = 'lg',
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** Override background colour (e.g. role colour). */
  accent?: string;
  style?: CSSProperties;
  className?: string;
  /** 'md': the compact button of desktop page headers. */
  size?: 'lg' | 'md';
  type?: 'button' | 'submit';
}) {
  const p = palette[variant];
  const bg = accent ?? p.bg;
  return (
    <Pressable
      type={type}
      className={`btn${size === 'md' ? ' btn-md' : ''}${className ? ` ${className}` : ''}`}
      onClick={onPress}
      disabled={disabled || loading}
      style={{
        height: size === 'md' ? 44 : 54, borderRadius: size === 'md' ? radius.md : radius.lg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: size === 'md' ? '0 16px' : '0 20px', backgroundColor: bg, border: p.border ? `1px solid ${p.border}` : 0, flexShrink: 0, minWidth: 0,
        ...style,
      }}
    >
      {loading ? (
        <span className="spinner" style={{ color: p.fg }} />
      ) : (
        <span className="h" style={{ gap: 8, minWidth: 0 }}>
          {icon && <Icon name={icon} size={18} color={p.fg} />}
          <Text variant="bodyStrong" color={p.fg} lines={1}>{title}</Text>
        </span>
      )}
    </Pressable>
  );
}
