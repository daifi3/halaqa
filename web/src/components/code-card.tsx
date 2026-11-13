import { useState } from 'react';
import { copyText } from '@/lib/links';
import { colors, radius } from '@/theme';
import { Icon } from './ui/icon';
import { delay } from './ui/misc';
import { Pressable } from './ui/pressable';
import { Text } from './ui/text';

/** The teacher's dark join-code card, with QR and copy buttons. */
export function CodeCard({ code, showQr, onToggleQr, delayMs }: {
  code: string; showQr: boolean; onToggleQr: () => void; delayMs: number;
}) {
  const [copied, setCopied] = useState(false);
  const pill: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#fff', padding: '10px 14px', borderRadius: radius.pill,
  };
  return (
    <div className="h a-down" style={{ ...delay(delayMs), backgroundColor: colors.ink, borderRadius: radius.xl, padding: 20, gap: 12 }}>
      <div className="v flex1" style={{ gap: 4 }}>
        <Text variant="label" color="rgba(255,255,255,0.6)">Join code</Text>
        <Text variant="title" color="#fff" style={{ letterSpacing: 6 }}>{code}</Text>
      </div>
      <div className="h" style={{ gap: 8 }}>
        <Pressable onClick={onToggleQr} aria-label="Show QR code" aria-pressed={showQr} style={{ ...pill, backgroundColor: showQr ? colors.primary : '#fff' }}>
          <Icon name="qr-code-outline" size={18} color={showQr ? '#fff' : colors.ink} />
        </Pressable>
        <Pressable onClick={async () => { await copyText(code); setCopied(true); }} style={pill}>
          <Icon name={copied ? 'checkmark' : 'copy-outline'} size={18} color={colors.ink} />
          <Text variant="small">{copied ? 'Copied' : 'Copy'}</Text>
        </Pressable>
      </div>
    </div>
  );
}
