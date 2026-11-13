import type { ReactNode } from 'react';
import { IconButton } from '@/components/ui/misc';
import { colors } from '@/theme';

/**
 * A tab's scrolling page, with room under it for the floating tab bar. The
 * refresh button stands in for pull-to-refresh.
 */
export function TabPage({ children, onRefresh, refreshing, gap = 20 }: {
  children: ReactNode; onRefresh?: () => void; refreshing?: boolean; gap?: number;
}) {
  return (
    <main className="content tab-page" style={{ gap, paddingBottom: 140, position: 'relative' }}>
      {/* Phones only: on a computer the page already reloads when you come back to the tab. */}
      {onRefresh && (
        <span className="mobile-only">
        <IconButton
          icon="refresh"
          label="Refresh"
          onPress={onRefresh}
          size={36}
          color={colors.muted}
          bg="transparent"
          style={{ position: 'absolute', top: 14, right: 14, animation: refreshing ? 'spin 800ms linear infinite' : undefined }}
        />
        </span>
      )}
      {children}
    </main>
  );
}
