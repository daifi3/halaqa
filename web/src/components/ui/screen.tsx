import type { CSSProperties, ReactNode } from 'react';
import { useBack } from '@/lib/navigation';
import { colors } from '@/theme';
import { Icon } from './icon';
import { IconButton } from './misc';
import { Pressable } from './pressable';
import { Text } from './text';

/** Phones: the app's round back button. Desktop: a "Back" link above the page title. */
export function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <>
      <span className="mobile-only"><IconButton icon="chevron-back" onPress={onPress} label="Back" /></span>
      <Pressable className="desktop-only back-link" scaleTo={0.97} onClick={onPress} aria-label="Back">
        <Icon name="arrow-back" size={16} color={colors.inkSoft} />
        <Text variant="bodyStrong" color={colors.inkSoft}>Back</Text>
      </Pressable>
    </>
  );
}

/**
 * A page's title row. The actions (buttons) show at its right on desktop; phones
 * keep the app's own big action cards further down the page instead.
 */
export function PageHeader({ eyebrow, title, subtitle, actions, aside, display }: {
  eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode;
  /** Shown at the right on every screen size (e.g. the avatar on Home). */
  aside?: ReactNode;
  /** The large title style of detail pages. */
  display?: boolean;
}) {
  return (
    <div className="page-header a-up">
      <div className="v flex1" style={{ gap: 4, minWidth: 0 }}>
        {eyebrow}
        {typeof title === 'string' ? <Text variant={display ? 'display' : 'title'}>{title}</Text> : title}
        {typeof subtitle === 'string' ? <Text color={colors.muted}>{subtitle}</Text> : subtitle}
      </div>
      {actions && <div className="page-actions desktop-only">{actions}</div>}
      {aside}
    </div>
  );
}

/** A pushed screen: back button row on top, content below. */
export function Screen({ children, right, back = true, narrow, style }: {
  children: ReactNode; right?: ReactNode; back?: boolean; narrow?: boolean; style?: CSSProperties;
}) {
  const goBack = useBack();
  return (
    <div className="page">
      <div className={`content screen-top${narrow ? ' narrow' : ''}`} style={{ paddingBottom: 0, paddingTop: 16 }}>
        <div className="h" style={{ justifyContent: 'space-between', gap: 8 }}>
          {back ? <BackButton onPress={goBack} /> : <span />}
          {right}
        </div>
      </div>
      <div className={`content screen-body${narrow ? ' narrow' : ''}`} style={{ flex: 1, ...style }}>{children}</div>
    </div>
  );
}

/**
 * A modal-style screen (new room, new course, upload…): a title with a close
 * button, scrolling content, and a footer pinned to the bottom of the window.
 * On desktop it's a card in the middle of the page, its button at the bottom right.
 */
export function ModalScreen({ title, children, footer, onClose }: {
  title: string; children: ReactNode; footer?: ReactNode; onClose?: () => void;
}) {
  const goBack = useBack();
  return (
    <div className="page modal-page" style={{ backgroundColor: colors.bg }}>
      <div className="modal-card">
        <div className="content narrow modal-head" style={{ paddingBottom: 8 }}>
          <div className="h" style={{ justifyContent: 'space-between', paddingTop: 4 }}>
            <Text variant="title">{title}</Text>
            <IconButton icon="close" onPress={onClose ?? goBack} label="Close" />
          </div>
        </div>
        <div className="content narrow modal-body" style={{ flex: 1, gap: 28, paddingBottom: 40 }}>{children}</div>
        {footer && (
          <div className="modal-foot" style={{ position: 'sticky', bottom: 0, background: `linear-gradient(transparent, ${colors.bg} 18px)`, paddingTop: 18 }}>
            <div className="content narrow modal-footer v" style={{ paddingTop: 0, paddingBottom: 'max(env(safe-area-inset-bottom), 16px)', gap: 8 }}>
              {footer}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** A labelled group inside a form (the "Section" of the app's modal screens). */
export function Section({ title, hint, children, delayMs = 0, wide }: {
  title: string; hint?: string; children: ReactNode; delayMs?: number;
  /** Kept for callers; the desktop form is a single column now. */
  wide?: boolean;
}) {
  return (
    <section className={`v a-down${wide ? ' span-all' : ''}`} style={{ gap: 12, animationDelay: `${delayMs}ms` }}>
      <div className="v" style={{ gap: 2 }}>
        <Text variant="label" color={colors.muted}>{title}</Text>
        {hint && <Text variant="small" color={colors.muted}>{hint}</Text>}
      </div>
      {children}
    </section>
  );
}
