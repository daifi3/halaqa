import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { colors, radius } from '@/theme';

export const PAGE_SIZES = [12, 24, 48];

/** Waits until typing pauses, so a search doesn't hit the server on every key. */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Page numbers around the current one, with gaps: 1 … 4 5 6 … 12 */
function pageWindow(page: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const out: (number | 'gap')[] = [0];
  const from = Math.max(1, page - 1);
  const to = Math.min(total - 2, page + 1);
  if (from > 1) out.push('gap');
  for (let i = from; i <= to; i++) out.push(i);
  if (to < total - 2) out.push('gap');
  out.push(total - 1);
  return out;
}

/** "13–24 of 57", previous / numbered pages / next, and how many per page. page is 0-based. */
export function Pagination({ page, totalPages, total, size, onPage, onSize, noun = 'items' }: {
  page: number; totalPages: number; total: number; size: number; onPage: (p: number) => void; onSize: (s: number) => void;
  noun?: string;
}) {
  const first = total === 0 ? 0 : page * size + 1;
  const last = Math.min(total, (page + 1) * size);
  const btn = (key: string, content: ReactNode, target: number, opts: { active?: boolean; disabled?: boolean; label?: string } = {}) => (
    <Pressable key={key} scaleTo={0.92} disabled={opts.disabled} onClick={() => onPage(target)} aria-label={opts.label}
      aria-current={opts.active ? 'page' : undefined}
      style={{
        minWidth: 36, height: 36, padding: '0 8px', borderRadius: radius.md, display: 'flex', alignItems: 'center',
        justifyContent: 'center', backgroundColor: opts.active ? colors.inverse : colors.surface,
        boxShadow: opts.active ? 'none' : 'var(--shadow-card)', opacity: opts.disabled ? 0.4 : 1,
      }}>
      {typeof content === 'string' || typeof content === 'number'
        ? <Text variant="bodyStrong" color={opts.active ? '#fff' : colors.ink}>{content}</Text>
        : content}
    </Pressable>
  );
  return (
    <nav className="admin-pager" aria-label="Pages">
      <Text variant="small" color={colors.muted}>{total === 0 ? `No ${noun}` : `${first}–${last} of ${total}`}</Text>
      {totalPages > 1 && (
        <span className="h" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          {btn('prev', <Icon name="chevron-back" size={18} color={colors.ink} />, page - 1, { disabled: page === 0, label: 'Previous page' })}
          {pageWindow(page, totalPages).map((p, i) => p === 'gap'
            ? <Text key={`gap${i}`} color={colors.muted} style={{ padding: '0 2px' }}>…</Text>
            : btn(`p${p}`, p + 1, p, { active: p === page, label: `Page ${p + 1}` }))}
          {btn('next', <Icon name="chevron-forward" size={18} color={colors.ink} />, page + 1, { disabled: page >= totalPages - 1, label: 'Next page' })}
        </span>
      )}
      <label className="h" style={{ gap: 8 }}>
        <Text variant="small" color={colors.muted}>Per page</Text>
        <select className="admin-select" value={size} onChange={(e) => onSize(Number(e.target.value))}>
          {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
    </nav>
  );
}
