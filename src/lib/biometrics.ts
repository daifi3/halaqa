/**
 * Device biometrics (fingerprint, face, iris) through expo-local-authentication.
 *
 * The app never sees biometric data: the OS keeps fingerprints and face models
 * in secure hardware and only answers "was this the enrolled owner — yes/no".
 * All Halaqa stores is metadata about the lock (see store/security-prefs.ts).
 */
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

// Throws on import when its native code is missing (a build made before it was
// added), and every route loads at startup — so only load it when present.
const LocalAuthentication: typeof import('expo-local-authentication') | null =
  requireOptionalNativeModule('ExpoLocalAuthentication')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ? require('expo-local-authentication')
    : null;

export type BiometricMethod = 'fingerprint' | 'face' | 'iris';

export interface BiometricSupport {
  /** A sensor exists and the owner has enrolled at least one fingerprint/face. */
  available: boolean;
  /** A sensor exists but nothing is enrolled yet — the user can set it up in Settings. */
  needsEnrollment: boolean;
  /** This build of the app doesn't include the biometrics module yet — the phone may well have a sensor. */
  needsAppUpdate: boolean;
  method: BiometricMethod | null;
}

export function methodLabel(method: BiometricMethod | null) {
  if (method === 'face') return Platform.OS === 'ios' ? 'Face ID' : 'Face unlock';
  if (method === 'iris') return 'Iris unlock';
  return 'Fingerprint';
}

export async function getBiometricSupport(): Promise<BiometricSupport> {
  if (!LocalAuthentication) return { available: false, needsEnrollment: false, needsAppUpdate: true, method: null };
  const { AuthenticationType } = LocalAuthentication;
  const [hardware, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  // Prefer the fingerprint when the phone has several sensors.
  const method: BiometricMethod | null = types.includes(AuthenticationType.FINGERPRINT) ? 'fingerprint'
    : types.includes(AuthenticationType.FACIAL_RECOGNITION) ? 'face'
      : types.includes(AuthenticationType.IRIS) ? 'iris'
        : null;
  return { available: hardware && enrolled, needsEnrollment: hardware && !enrolled, needsAppUpdate: false, method };
}

export type AuthResult = { ok: true } | { ok: false; cancelled: boolean; message: string };

const MESSAGES: Partial<Record<string, string>> = {
  lockout: 'Too many attempts. Unlock your phone with its PIN, then try again.',
  not_enrolled: 'No fingerprint or face is set up on this phone.',
  passcode_not_set: 'Set a screen lock on this phone first.',
  not_available: 'Biometric unlock isn’t available on this phone.',
};

/** Shows the system prompt. The phone's own PIN/pattern is offered after repeated failures. */
export async function authenticate(promptMessage: string): Promise<AuthResult> {
  if (!LocalAuthentication) return { ok: false, cancelled: false, message: 'This version of Halaqa needs an update to use biometric unlock.' };
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });
  if (result.success) return { ok: true };
  const cancelled = result.error === 'user_cancel' || result.error === 'system_cancel' || result.error === 'app_cancel';
  return { ok: false, cancelled, message: MESSAGES[result.error] ?? 'That didn’t work. Please try again.' };
}
