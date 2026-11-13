import { useEffect } from 'react';
import { useDialogs, type DialogButton } from '@/lib/dialog';
import { colors, radius } from '@/theme';
import { Pressable } from './ui/pressable';
import { Text } from './ui/text';

function ButtonRow({ buttons, onPick }: { buttons: DialogButton[]; onPick: (b: DialogButton) => void }) {
  // Cancel sits on the left, like the platform dialogs.
  const ordered = [...buttons].sort((a, b) => Number(b.style === 'cancel') - Number(a.style === 'cancel'));
  return (
    <div className="h wrap" style={{ gap: 8, justifyContent: 'flex-end' }}>
      {ordered.map((b) => {
        const primary = b.style !== 'cancel';
        const bg = b.style === 'destructive' ? colors.danger : primary ? colors.ink : colors.surfaceAlt;
        return (
          <Pressable
            key={b.text}
            onClick={() => onPick(b)}
            autoFocus={primary && b === ordered[ordered.length - 1]}
            style={{ height: 44, padding: '0 18px', borderRadius: radius.md, backgroundColor: bg, flexGrow: ordered.length > 2 ? 1 : 0 }}
          >
            <Text variant="bodyStrong" color={primary ? '#fff' : colors.ink}>{b.text}</Text>
          </Pressable>
        );
      })}
    </div>
  );
}

/** Renders the first queued dialog from `alert()` (lib/dialog). */
export function DialogHost() {
  const dialog = useDialogs((s) => s.queue[0]);
  const dismiss = useDialogs((s) => s.dismiss);

  const cancel = dialog?.buttons.find((b) => b.style === 'cancel') ?? (dialog?.buttons.length === 1 ? dialog.buttons[0] : undefined);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && cancel) {
        dismiss(dialog.id);
        cancel.onPress?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, cancel, dismiss]);

  if (!dialog) return null;
  const pick = (b: DialogButton) => {
    dismiss(dialog.id);
    b.onPress?.();
  };

  return (
    <div className="overlay" role="alertdialog" aria-modal aria-labelledby={`dlg-${dialog.id}`}>
      <div className="backdrop" onClick={() => cancel && pick(cancel)} />
      <div
        key={dialog.id}
        className="v a-zoom"
        style={{
          position: 'relative', width: '100%', maxWidth: 400, backgroundColor: colors.surface, borderRadius: radius.xl,
          padding: 22, gap: 16, boxShadow: 'var(--shadow-float)',
        }}
      >
        <div className="v" style={{ gap: 6 }}>
          <Text variant="heading" style={{ display: 'block' }}><span id={`dlg-${dialog.id}`}>{dialog.title}</span></Text>
          {dialog.message && <Text color={colors.inkSoft} className="pre">{dialog.message}</Text>}
        </div>
        <ButtonRow buttons={dialog.buttons} onPick={pick} />
      </div>
    </div>
  );
}
