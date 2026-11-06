import { requireOptionalNativeModule } from 'expo';

interface ExamLockNative {
  pinAsync(): Promise<void>;
  unpinAsync(): Promise<void>;
  isPinned(): boolean;
}

// Android only. Missing on iOS, on web, and in builds made before this module existed.
const native = requireOptionalNativeModule<ExamLockNative>('ExamLock');

export const ExamLock = {
  /** Whether this device can pin the app at all. */
  supported: !!native,
  /** Asks Android to pin the app. Shows the system's own "Pin this app?" prompt. */
  pin: () => native?.pinAsync() ?? Promise.resolve(),
  unpin: () => native?.unpinAsync() ?? Promise.resolve(),
  isPinned: () => native?.isPinned() ?? false,
};
