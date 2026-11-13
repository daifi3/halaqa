import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { authenticate, getBiometricSupport, methodLabel, type BiometricMethod } from '@/lib/biometrics';
import { biometricRecordOf, useSecurityPrefs } from '@/store/security-prefs';
import { useSession } from '@/store/session';
import { colors, radius, shadow } from '@/theme';

/** Away from the app longer than this locks it again. Short trips (a system dialog, exam pinning) don't. */
const LOCK_AFTER_MS = 30_000;

function iconFor(method: BiometricMethod | null) {
  return method === 'face' ? 'scan-outline' : method === 'iris' ? 'eye-outline' : 'finger-print';
}

/* ---------- Lock screen ---------- */

function LockScreen({ name, method, onUnlocked, onSignOut }: {
  name: string; method: BiometricMethod | null; onUnlocked: () => void; onSignOut: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const label = methodLabel(method);

  const unlock = useCallback(async () => {
    setBusy(true);
    const result = await authenticate(`Unlock Halaqa with your ${label.toLowerCase()}`);
    setBusy(false);
    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onUnlocked();
    } else if (!result.cancelled) {
      setError(result.message);
    }
  }, [label, onUnlocked]);

  // Ask straight away — that's what the user came for.
  useEffect(() => {
    const t = setTimeout(unlock, 350);
    return () => clearTimeout(t);
  }, [unlock]);

  return (
    <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(250)} style={[StyleSheet.absoluteFill, styles.lock]}>
      <SafeAreaView style={styles.lockInner} edges={['top', 'bottom']}>
        <View style={styles.lockCenter}>
          <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.lockIcon}>
            <Ionicons name={iconFor(method)} size={46} color="#fff" />
          </Animated.View>
          <Text variant="title" style={{ textAlign: 'center' }}>Halaqa is locked</Text>
          <Text color={colors.muted} style={{ textAlign: 'center', maxWidth: 280 }}>
            Hi {name.split(' ')[0]}, use your {label.toLowerCase()} to continue.
          </Text>
          {error && (
            <Animated.View entering={FadeInDown} style={styles.lockError}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text variant="small" color={colors.danger} style={{ flex: 1 }}>{error}</Text>
            </Animated.View>
          )}
        </View>
        <View style={{ gap: 6 }}>
          <Button title={`Unlock with ${label}`} icon={iconFor(method)} loading={busy} onPress={unlock} />
          <PressableScale scaleTo={0.96} onPress={onSignOut} style={styles.signOut}>
            <Text variant="small" color={colors.muted}>Sign out and use your password instead</Text>
          </PressableScale>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

/* ---------- First sign-in offer ---------- */

function EnableOffer({ method, onEnable, onSkip }: { method: BiometricMethod | null; onEnable: () => void; onSkip: () => void }) {
  const label = methodLabel(method);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onSkip}>
      <View style={styles.offerBackdrop}>
        <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.offer}>
          <View style={styles.offerIcon}>
            <Ionicons name={iconFor(method)} size={34} color={colors.success} />
          </View>
          <Text variant="heading" style={{ textAlign: 'center' }}>Unlock Halaqa with your {label.toLowerCase()}?</Text>
          <Text color={colors.inkSoft} style={{ textAlign: 'center' }}>
            Only you will be able to open your classes, exams and documents on this phone.
          </Text>
          <View style={styles.privacy}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.success} />
            <Text variant="small" color={colors.inkSoft} style={{ flex: 1 }}>
              Your {label.toLowerCase()} never leaves your phone. Halaqa only remembers that the lock is on.
            </Text>
          </View>
          <View style={{ gap: 4, alignSelf: 'stretch', marginTop: 4 }}>
            <Button title={`Turn on ${label}`} icon={iconFor(method)} accent={colors.success} onPress={onEnable} />
            <Button title="Not now" variant="ghost" onPress={onSkip} />
          </View>
          <Text variant="small" color={colors.muted}>You can change this any time in Profile.</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ---------- Gate ---------- */

/**
 * Mounted once at the root. Locks the app at launch and after LOCK_AFTER_MS in
 * the background when the account has biometric unlock on, and offers to turn
 * it on once after an account signs in on this device.
 */
export function BiometricGate() {
  const user = useSession((s) => s.user);
  const record = useSecurityPrefs((s) => biometricRecordOf(s, user?.id));
  const enableBiometric = useSecurityPrefs((s) => s.enableBiometric);
  const markOffered = useSecurityPrefs((s) => s.markOffered);

  // Locked at launch when an already signed-in account has the lock on.
  // Signing in with a password is proof enough, so a fresh sign-in starts unlocked.
  const [locked, setLocked] = useState(() => !!user && record.enabled);
  const [offer, setOffer] = useState<{ method: BiometricMethod | null } | null>(null);

  const enabledRef = useRef(record.enabled);
  useEffect(() => {
    enabledRef.current = record.enabled;
  }, [record.enabled]);

  useEffect(() => {
    let awayAt: number | null = null;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') awayAt = Date.now();
      else if (state === 'active' && awayAt !== null) {
        if (enabledRef.current && Date.now() - awayAt > LOCK_AFTER_MS) setLocked(true);
        awayAt = null;
      }
    });
    return () => sub.remove();
  }, []);

  // Offer once per account on this device, right after signing in.
  const userId = user?.id;
  const shouldOffer = !!userId && !record.enabled && !record.offeredAt;
  useEffect(() => {
    if (!shouldOffer) return;
    let alive = true;
    getBiometricSupport().then((support) => {
      // Not offered (and not marked) on phones without an enrolled sensor — it can still be turned on in Profile later.
      if (alive && support.available) setOffer({ method: support.method });
    });
    return () => { alive = false; };
  }, [shouldOffer]);

  async function acceptOffer() {
    if (!userId || !offer) return;
    const result = await authenticate(`Confirm your ${methodLabel(offer.method).toLowerCase()} to turn on the lock`);
    if (!result.ok) return; // Keep the offer open so they can retry or choose "Not now".
    enableBiometric(userId, offer.method);
    markOffered(userId);
    setOffer(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }

  function skipOffer() {
    if (userId) markOffered(userId);
    setOffer(null);
  }

  if (!user) return null;
  return (
    <>
      {offer && !locked && <EnableOffer method={offer.method} onEnable={acceptOffer} onSkip={skipOffer} />}
      {locked && record.enabled && (
        <LockScreen
          name={user.name}
          method={record.method}
          onUnlocked={() => setLocked(false)}
          onSignOut={() => { setLocked(false); void api.signOut(); }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  lock: { backgroundColor: colors.bg, zIndex: 100 },
  lockInner: { flex: 1, padding: 24, justifyContent: 'space-between' },
  lockCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  lockIcon: {
    width: 96, height: 96, borderRadius: 34, backgroundColor: colors.ink,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12, ...shadow.float,
  },
  lockError: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, padding: 12,
    borderRadius: radius.md, backgroundColor: colors.dangerSoft, maxWidth: 320,
  },
  signOut: { alignSelf: 'center', paddingVertical: 12 },
  offerBackdrop: { flex: 1, backgroundColor: 'rgba(22,23,28,0.45)', justifyContent: 'center', padding: 24 },
  offer: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: 24, gap: 12, alignItems: 'center', ...shadow.float,
  },
  offerIcon: {
    width: 68, height: 68, borderRadius: 24, backgroundColor: colors.successSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  privacy: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12,
    borderRadius: radius.md, backgroundColor: colors.bg, alignSelf: 'stretch',
  },
});
