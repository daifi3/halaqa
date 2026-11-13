import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { authenticate, enroll, getBiometricSupport, methodLabel } from '@/lib/biometrics';
import { biometricRecordOf, useSecurityPrefs } from '@/store/security-prefs';
import { useSession } from '@/store/session';
import { colors, radius } from '@/theme';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { Pressable } from './ui/pressable';
import { Text } from './ui/text';

/** Away from the tab longer than this locks the app again. */
const LOCK_AFTER_MS = 30_000;

/* ---------- Lock screen ---------- */

function LockScreen({ name, credentialId, onUnlocked, onSignOut }: {
  name: string; credentialId: string; onUnlocked: () => void; onSignOut: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const label = methodLabel();

  const unlock = useCallback(async () => {
    setBusy(true);
    const result = await authenticate(credentialId);
    setBusy(false);
    if (result.ok) onUnlocked();
    else if (!result.cancelled) setError(result.message);
  }, [credentialId, onUnlocked]);

  // Ask straight away — that's what the user came for.
  useEffect(() => {
    const t = setTimeout(unlock, 350);
    return () => clearTimeout(t);
  }, [unlock]);

  return (
    <div className="v a-fade" style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: colors.bg, padding: 24 }}>
      <div className="v flex1 center" style={{ gap: 12 }}>
        <span className="h center a-zoom" style={{ width: 96, height: 96, borderRadius: 34, backgroundColor: colors.ink, marginBottom: 12, boxShadow: 'var(--shadow-float)' }}>
          <Icon name="finger-print" size={46} color="#fff" />
        </span>
        <Text variant="title" style={{ textAlign: 'center' }}>Halaqa is locked</Text>
        <Text color={colors.muted} style={{ textAlign: 'center', maxWidth: 280 }}>
          Hi {name.split(' ')[0]}, use {label} to continue.
        </Text>
        {error && (
          <div className="h a-down" style={{ gap: 8, marginTop: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.dangerSoft, maxWidth: 320 }}>
            <Icon name="alert-circle" size={16} color={colors.danger} />
            <Text variant="small" color={colors.danger}>{error}</Text>
          </div>
        )}
      </div>
      <div className="v" style={{ gap: 6, width: '100%', maxWidth: 420, margin: '0 auto' }}>
        <Button title={`Unlock with ${label}`} icon="finger-print" loading={busy} onPress={unlock} />
        <Pressable onClick={onSignOut} style={{ alignSelf: 'center', padding: '12px 0' }}>
          <Text variant="small" color={colors.muted}>Sign out and use your password instead</Text>
        </Pressable>
      </div>
    </div>
  );
}

/* ---------- First sign-in offer ---------- */

function EnableOffer({ onEnable, onSkip, error }: { onEnable: () => void; onSkip: () => void; error: string | null }) {
  const label = methodLabel();
  return (
    <div className="overlay">
      <div className="backdrop" onClick={onSkip} />
      <div className="v a-up" style={{ position: 'relative', maxWidth: 420, backgroundColor: colors.surface, borderRadius: radius.xl, padding: 24, gap: 12, alignItems: 'center', boxShadow: 'var(--shadow-float)' }}>
        <span className="h center" style={{ width: 68, height: 68, borderRadius: 24, backgroundColor: colors.successSoft, marginBottom: 4 }}>
          <Icon name="finger-print" size={34} color={colors.success} />
        </span>
        <Text variant="heading" style={{ textAlign: 'center' }}>Unlock Halaqa with {label}?</Text>
        <Text color={colors.inkSoft} style={{ textAlign: 'center' }}>
          Only you will be able to open your classes, exams and documents in this browser.
        </Text>
        <div className="h" style={{ gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.bg, alignSelf: 'stretch' }}>
          <Icon name="shield-checkmark-outline" size={16} color={colors.success} />
          <Text variant="small" color={colors.inkSoft} className="flex1">
            Your fingerprint or face never leaves your device. Halaqa only remembers that the lock is on.
          </Text>
        </div>
        {error && <Text variant="small" color={colors.danger}>{error}</Text>}
        <div className="v" style={{ gap: 4, alignSelf: 'stretch', marginTop: 4 }}>
          <Button title={`Turn on ${label}`} icon="finger-print" accent={colors.success} onPress={onEnable} />
          <Button title="Not now" variant="ghost" onPress={onSkip} />
        </div>
        <Text variant="small" color={colors.muted}>You can change this any time in Profile.</Text>
      </div>
    </div>
  );
}

/* ---------- Gate ---------- */

/**
 * Mounted once at the root. Locks the app when it opens, and after LOCK_AFTER_MS
 * on another tab, when the account has device unlock on — and offers to turn it
 * on once after an account signs in in this browser.
 */
export function BiometricGate() {
  const user = useSession((s) => s.user);
  const record = useSecurityPrefs((s) => biometricRecordOf(s, user?.id));
  const enableBiometric = useSecurityPrefs((s) => s.enableBiometric);
  const markOffered = useSecurityPrefs((s) => s.markOffered);

  // Locked at launch when an already signed-in account has the lock on.
  // Signing in with a password is proof enough, so a fresh sign-in starts unlocked.
  const [locked, setLocked] = useState(() => !!user && record.enabled);
  const [offer, setOffer] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);

  const enabledRef = useRef(record.enabled);
  useEffect(() => {
    enabledRef.current = record.enabled;
  }, [record.enabled]);

  useEffect(() => {
    let awayAt: number | null = null;
    const onChange = () => {
      if (document.visibilityState === 'hidden') awayAt = Date.now();
      else if (awayAt !== null) {
        if (enabledRef.current && Date.now() - awayAt > LOCK_AFTER_MS) setLocked(true);
        awayAt = null;
      }
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  // Offer once per account in this browser, right after signing in.
  const userId = user?.id;
  const shouldOffer = !!userId && !record.enabled && !record.offeredAt;
  useEffect(() => {
    if (!shouldOffer) return;
    let alive = true;
    getBiometricSupport().then((support) => {
      if (alive && support.available) setOffer(true);
    });
    return () => { alive = false; };
  }, [shouldOffer]);

  async function acceptOffer() {
    if (!user) return;
    const result = await enroll(user);
    if (!result.ok) {
      if (!result.cancelled) setOfferError(result.message);
      return; // Keep the offer open so they can retry or choose "Not now".
    }
    enableBiometric(user.id, result.credentialId);
    markOffered(user.id);
    setOffer(false);
  }

  function skipOffer() {
    if (userId) markOffered(userId);
    setOffer(false);
  }

  if (!user) return null;
  return (
    <>
      {offer && !locked && <EnableOffer onEnable={acceptOffer} onSkip={skipOffer} error={offerError} />}
      {locked && record.enabled && record.credentialId && (
        <LockScreen
          name={user.name}
          credentialId={record.credentialId}
          onUnlocked={() => setLocked(false)}
          onSignOut={() => { setLocked(false); void api.signOut(); }}
        />
      )}
    </>
  );
}
