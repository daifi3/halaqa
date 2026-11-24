import { useEffect, useState } from 'react';
import { StoreBadges } from './auth-art';
import { Icon } from './ui/icon';
import { Text } from './ui/text';
import { colors } from '@/theme';

type Mode = 'card' | 'leaving' | 'bubble';

const SEEN_KEY = 'halaqa.appPromptSeen';

/** Whether the card has already shown (and collapsed) in this tab, so other sign-in screens start as the bubble. */
function seen() {
  try { return sessionStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
}
function markSeen() {
  try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode: just show it again next time */ }
}

/**
 * Phones and tablets only (CSS hides it next to the desktop art panel):
 * a "Get the mobile app" card that stays for 10 seconds, then shrinks into a bubble in the
 * top-right corner. Tapping the bubble brings the card (and its download buttons) back.
 */
export function AppDownloadPrompt({ belowNav = false }: { belowNav?: boolean } = {}) {
  /** On pages with a sticky top bar (the landing page), sit under it instead of over it. */
  const offset = belowNav ? ' below-nav' : '';
  const [mode, setMode] = useState<Mode>(() => (seen() ? 'bubble' : 'card'));
  // Opened from the bubble: no countdown, it stays until closed.
  const [manual, setManual] = useState(false);

  const collapse = () => {
    markSeen();
    setMode('leaving');
  };

  useEffect(() => {
    if (mode !== 'card' || !manual) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') collapse(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, manual]);

  if (mode === 'bubble') {
    return (
      <button
        type="button"
        className={`app-prompt-bubble${offset}`}
        aria-label="Get the mobile app"
        aria-expanded={false}
        onClick={() => { setManual(true); setMode('card'); }}
      >
        <Icon name="logo-android" size={26} color="#3DDC84" />
        <span className="app-prompt-bubble-dot" />
      </button>
    );
  }

  return (
    <div
      className={`app-prompt-card${offset}${mode === 'leaving' ? ' leaving' : ''}`}
      role="dialog"
      aria-label="Get the mobile app"
      onAnimationEnd={(e) => { if (e.animationName === 'appPromptOut') setMode('bubble'); }}
    >
      <div className="app-prompt-head">
        <span className="app-prompt-icon"><Icon name="phone-portrait-outline" size={20} color="#fff" /></span>
        <div className="v flex1" style={{ gap: 2, minWidth: 0 }}>
          <Text variant="bodyStrong">Get the Halaqa app</Text>
          <Text variant="small" color={colors.muted}>Classes, chat and calls — right on your phone.</Text>
        </div>
        <button type="button" className="app-prompt-close" aria-label="Minimise" onClick={collapse}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <StoreBadges />
      {!manual && (
        <span
          className="app-prompt-progress"
          onAnimationEnd={(e) => { e.stopPropagation(); if (e.animationName === 'appPromptCountdown') collapse(); }}
        />
      )}
    </div>
  );
}
