import type { CSSProperties } from 'react';
import { ICONS } from './icon-registry';
import { MDI, type MdiName } from './mdi';

/** Ionicons — the same set the app uses through @expo/vector-icons. */
export type IconName = keyof typeof ICONS;

/** Ionicons ships each icon as an SVG data URL; inline the markup so it follows `color`. */
const markup = new Map<string, string>();
function svgOf(name: IconName) {
  let svg = markup.get(name);
  if (!svg) {
    svg = ICONS[name].replace(/^data:image\/svg\+xml;utf8,/, '');
    markup.set(name, svg);
  }
  return svg;
}

export function Icon({ name, size = 18, color, style }: { name: IconName; size?: number; color?: string; style?: CSSProperties }) {
  return (
    <span
      className="icon"
      aria-hidden
      style={{ width: size, height: size, color, ...style }}
      dangerouslySetInnerHTML={{ __html: svgOf(name) }}
    />
  );
}

/** Material Community Icons — used by the whiteboard tools, as in the app. */
export function McIcon({ name, size = 19, color }: { name: MdiName; size?: number; color?: string }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d={MDI[name]} fill={color ?? 'currentColor'} />
    </svg>
  );
}
