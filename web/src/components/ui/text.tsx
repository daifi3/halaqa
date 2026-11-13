import type { CSSProperties, ReactNode } from 'react';
import type { type as typeScale } from '@/theme';
import { colors } from '@/theme';

export type TextVariant = keyof typeof typeScale;

/** The app's <Text>: one of the type-scale variants, in a colour. Nested Text flows inline. */
export function Text({
  variant = 'body', color = colors.ink, style, className, lines, children, title,
}: {
  variant?: TextVariant;
  color?: string;
  style?: CSSProperties;
  className?: string;
  /** Truncate after this many lines (1 or 2), like numberOfLines. */
  lines?: 1 | 2;
  children?: ReactNode;
  title?: string;
}) {
  const clamp = lines === 1 ? ' clamp1' : lines === 2 ? ' clamp2' : '';
  return (
    <span className={`t t-${variant}${clamp}${className ? ` ${className}` : ''}`} style={{ color, ...style }} title={title}>
      {children}
    </span>
  );
}
