/**
 * Device unlock (fingerprint, face, Windows Hello…) through WebAuthn's platform
 * authenticator — the browser's counterpart of expo-local-authentication.
 *
 * Like the app, this is a local lock: the browser asks the device to verify its
 * owner and only answers yes or no. Halaqa keeps the id of a key the device
 * created for this account (see store/security-prefs.ts) — never biometric data.
 */

export interface BiometricSupport {
  available: boolean;
  /** Why it isn't available, in words for the user. */
  reason: string | null;
}

export type AuthResult = { ok: true } | { ok: false; cancelled: boolean; message: string };

export function methodLabel() {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return 'Windows Hello';
  if (/iPhone|iPad|Macintosh/i.test(ua)) return 'Touch ID';
  if (/Android/i.test(ua)) return 'Fingerprint';
  return 'Device unlock';
}

export async function getBiometricSupport(): Promise<BiometricSupport> {
  if (!window.isSecureContext) {
    return { available: false, reason: 'Device unlock needs a secure connection (https or localhost).' };
  }
  if (!window.PublicKeyCredential) {
    return { available: false, reason: 'This browser doesn’t support device unlock.' };
  }
  const platform = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false);
  return platform
    ? { available: true, reason: null }
    : { available: false, reason: 'This device has no fingerprint, face or PIN unlock that the browser can use. Set one up in your system settings first.' };
}

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function failure(e: unknown): AuthResult {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError' || name === 'AbortError') return { ok: false, cancelled: true, message: 'Cancelled' };
  return { ok: false, cancelled: false, message: e instanceof Error ? e.message : 'Couldn’t verify it’s you' };
}

/** Creates this account's unlock key on the device. Resolves with its id (to store), or a failure. */
export async function enroll(user: { id: string; name: string; email: string }): Promise<{ ok: true; credentialId: string } | Exclude<AuthResult, { ok: true }>> {
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: random(32),
        rp: { name: 'Halaqa' },
        user: { id: new TextEncoder().encode(user.id), name: user.email, displayName: user.name },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return { ok: false, cancelled: true, message: 'Cancelled' };
    return { ok: true, credentialId: toB64(cred.rawId) };
  } catch (e) {
    return failure(e) as Exclude<AuthResult, { ok: true }>;
  }
}

/** Asks the device to confirm its owner with the key created by `enroll`. */
export async function authenticate(credentialId: string): Promise<AuthResult> {
  try {
    const cred = await navigator.credentials.get({
      publicKey: {
        challenge: random(32),
        allowCredentials: [{ type: 'public-key', id: fromB64(credentialId) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    return cred ? { ok: true } : { ok: false, cancelled: true, message: 'Cancelled' };
  } catch (e) {
    return failure(e);
  }
}
