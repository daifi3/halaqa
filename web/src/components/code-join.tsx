import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useBack } from '@/lib/navigation';
import { colors, radius } from '@/theme';
import { ScanPanel } from './scan-panel';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { IconButton } from './ui/misc';
import { Pressable } from './ui/pressable';
import { Text } from './ui/text';

const LENGTH = 6;

function Cell({ char, active, focused }: { char?: string; active: boolean; focused: boolean }) {
  const on = active && focused;
  return (
    <span
      className="h center flex1"
      style={{
        height: 60, borderRadius: radius.md, border: `1.5px solid ${char ? colors.studentSoft : on ? colors.student : colors.line}`,
        backgroundColor: char ? colors.studentSoft : colors.surface, transition: 'all 160ms',
      }}
    >
      <Text variant="title">{char ?? ''}</Text>
    </span>
  );
}

/**
 * "Join a class" / "Join a course": six code cells over one hidden input.
 * Opened from a QR link (/join?code=XXXXXX) it joins straight away.
 */
export function CodeJoin({ title, button, demoCode, join }: {
  title: string;
  button: string;
  demoCode: string;
  /** Joins and returns where to go next. */
  join: (code: string) => Promise<string>;
}) {
  const [params] = useSearchParams();
  const linked = (params.get('code') ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, LENGTH);
  const autoJoin = linked.length === LENGTH;
  const [code, setCode] = useState(linked);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(autoJoin);
  const [focused, setFocused] = useState(false);
  const [shake, setShake] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const back = useBack();

  async function run(value: string) {
    setLoading(true);
    try {
      navigate(await join(value), { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join');
      setShake((n) => n + 1);
      navigator.vibrate?.(60);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (autoJoin) void run(linked);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for the link we were opened with
  }, []);

  return (
    <div className="page center-wide">
      <div className="content narrow focus-card join-card" style={{ padding: 24, paddingTop: 20, gap: 20 }}>
        <div className="v join-code" style={{ gap: 20 }}>
        <div className="h" style={{ justifyContent: 'space-between', gap: 12 }}>
          <div className="v" style={{ gap: 6 }}>
            <Text variant="title">{title}</Text>
            <Text color={colors.muted}>Enter the 6-character code your teacher shared.</Text>
          </div>
          <IconButton icon="close" onPress={back} label="Close" />
        </div>

        <div
          key={shake}
          className={`h${shake ? ' a-shake' : ''}`}
          style={{ gap: 8, position: 'relative', cursor: 'text' }}
          onClick={() => input.current?.focus()}
        >
          {Array.from({ length: LENGTH }, (_, i) => (
            <Cell key={i} char={code[i]} active={i === Math.min(code.length, LENGTH - 1)} focused={focused} />
          ))}
          <input
            ref={input}
            value={code}
            autoFocus={!autoJoin}
            maxLength={LENGTH}
            autoCapitalize="characters"
            autoComplete="one-time-code"
            spellCheck={false}
            aria-label="Join code"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => { setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, LENGTH)); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && code.length === LENGTH) void run(code); }}
            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', caretColor: 'transparent' }}
          />
        </div>
        {error ? <Text variant="small" color={colors.danger}>{error}</Text> : <Text variant="small" color={colors.muted}>Demo code: {demoCode}</Text>}

        <Button title={button} icon="enter-outline" accent={colors.student} loading={loading} disabled={code.length < LENGTH} onPress={() => run(code)} />
        {/* Phones open the full-screen scanner; computers have it right beside the code. */}
        <Pressable className="mobile-only" onClick={() => navigate('/scan', { replace: true })}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '6px 0' }}>
          <Icon name="qr-code-outline" size={18} color={colors.student} />
          <Text variant="bodyStrong" color={colors.student}>Scan a QR code instead</Text>
        </Pressable>
        </div>

        <div className="join-or desktop-only" aria-hidden>
          <Text variant="small" color={colors.muted}>or</Text>
        </div>
        <div className="desktop-only"><ScanPanel /></div>
      </div>
    </div>
  );
}
