import type { ButtonHTMLAttributes, CSSProperties } from 'react';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> & {
  style?: CSSProperties;
  /** How far the element shrinks while pressed (0.96 = 4%). */
  scaleTo?: number;
  /** Hover feedback for pointer devices. */
  hover?: boolean;
};

/** A button that springs down when pressed — the base of every tappable surface. */
export function Pressable({ style, scaleTo = 0.96, hover = true, className, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      {...rest}
      className={`press${hover ? ' hoverable' : ''}${className ? ` ${className}` : ''}`}
      style={{ ['--press-scale' as string]: scaleTo, ...style }}
    />
  );
}
