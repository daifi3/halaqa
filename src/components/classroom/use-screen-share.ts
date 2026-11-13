import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';
import { api } from '@/lib/api';
import { fromTeacherOnly, type Peer, type ScreenSignal } from '@/lib/screen-share';

export interface ActiveShare {
  ownerId: string;
  name: string;
  isLocal: boolean;
  /** The shared screen; absent for your own share (no point mirroring it) and in mock mode. */
  video?: ReactNode;
  /** The shared picture's width / height, when known: lines drawings up with the video. */
  aspect?: number | null;
}

/** The platform side of screen sharing, supplied by the live or demo stage. */
export interface ScreenCapture {
  supported: boolean;
  sharing: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  /** The share shown in class right now, if any. */
  active: ActiveShare | null;
}

export type StudentNotice = 'granted' | 'denied' | 'revoked' | null;

const failed = (e: unknown) =>
  Alert.alert('Screen sharing failed', e instanceof Error ? e.message : 'Please try again.');

export function useScreenShare({ signal, capture, isTeacher, myId, roomId, connected }: {
  signal: ScreenSignal;
  capture: ScreenCapture;
  isTeacher: boolean;
  myId: string;
  roomId: string;
  connected: boolean;
}) {
  // Teacher
  const [requests, setRequests] = useState<Peer[]>([]);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [granted, setGranted] = useState<Set<string>>(() => new Set());
  // Student
  const [allowedMe, setAllowedMe] = useState(false);
  /** The teacher stopped this student — the open policy no longer covers them until it changes. */
  const [blocked, setBlocked] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<StudentNotice>(null);

  // The subscription lives for the whole class; read current values through refs.
  const latest = useRef({ policyOpen, granted, capture });
  useEffect(() => {
    latest.current = { policyOpen, granted, capture };
  });

  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showNotice = (n: Exclude<StudentNotice, null>) => {
    setNotice(n);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), n === 'granted' ? 12_000 : 5000);
  };

  useEffect(() => signal.subscribe((msg, from) => {
    if (fromTeacherOnly(msg) && !from.teacher) return;

    if (isTeacher) {
      if (msg.t === 'request' && !from.teacher) {
        setRequests((list) => (list.some((p) => p.id === from.id) ? list : [...list, from]));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      } else if (msg.t === 'cancel') {
        setRequests((list) => list.filter((p) => p.id !== from.id));
      } else if (msg.t === 'hello') {
        signal.send({ t: 'policy', open: latest.current.policyOpen });
        if (latest.current.granted.has(from.id)) signal.send({ t: 'grant', to: from.id });
      }
      return;
    }

    if (msg.t === 'policy') {
      setPolicyOpen(msg.open);
      setBlocked(false);
      if (!msg.open) {
        // Closing the room revokes everyone's grant on the server too.
        setAllowedMe(false);
        if (latest.current.capture.sharing) {
          latest.current.capture.stop().catch(() => {});
          showNotice('revoked');
        }
      }
    } else if ('to' in msg && msg.to === myId) {
      if (msg.t === 'grant') {
        setAllowedMe(true);
        setBlocked(false);
        setPending(false);
        showNotice('granted');
      } else if (msg.t === 'deny') {
        setPending(false);
        showNotice('denied');
      } else if (msg.t === 'revoke') {
        setAllowedMe(false);
        setBlocked(true);
        if (latest.current.capture.sharing) latest.current.capture.stop().catch(() => {});
        showNotice('revoked');
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }), [signal, isTeacher, myId]);

  // A student who joins (or reconnects) asks the teacher where things stand.
  useEffect(() => {
    if (connected && !isTeacher) signal.send({ t: 'hello' });
  }, [connected, isTeacher, signal]);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  async function startMine() {
    if (!capture.supported) {
      Alert.alert('Not available yet', 'Screen sharing from this device isn’t supported yet. You can still watch other people’s screens.');
      return;
    }
    setNotice(null);
    await capture.start().catch(failed);
  }

  const canShare = isTeacher || (!blocked && (policyOpen || allowedMe));

  return {
    requests, policyOpen, pending, notice, canShare,
    dismissNotice: () => setNotice(null),
    startMine,
    stopMine: () => capture.stop().catch(failed),

    /** Student: share if allowed, otherwise ask the teacher. */
    studentPress() {
      if (capture.sharing) return void capture.stop().catch(failed);
      if (canShare) return void startMine();
      if (pending) {
        Alert.alert('Waiting for your teacher', 'Your request to share your screen is waiting for an answer.', [
          { text: 'Keep waiting', style: 'cancel' },
          { text: 'Cancel request', style: 'destructive', onPress: () => { signal.send({ t: 'cancel' }); setPending(false); } },
        ]);
        return;
      }
      Alert.alert('Share your screen?', 'Your teacher needs to accept before you can share.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Ask teacher', onPress: () => { signal.send({ t: 'request' }); setPending(true); } },
      ]);
    },

    /** Teacher: answer a student's request. */
    async respond(peer: Peer, allow: boolean) {
      setRequests((list) => list.filter((p) => p.id !== peer.id));
      try {
        if (allow) {
          await api.setScreenShareGrant(roomId, peer.id, true);
          setGranted((g) => new Set(g).add(peer.id));
        }
        signal.send({ t: allow ? 'grant' : 'deny', to: peer.id });
      } catch (e) {
        failed(e);
      }
    },

    /** Teacher: let every student share without asking, or take it back. */
    async setPolicy(open: boolean) {
      try {
        await api.setScreenSharePolicy(roomId, open);
        setPolicyOpen(open);
        if (!open) setGranted(new Set());
        signal.send({ t: 'policy', open });
      } catch (e) {
        failed(e);
      }
    },

    /** Teacher: stop a student's share and take their permission back. */
    async stopStudent(id: string) {
      try {
        await api.setScreenShareGrant(roomId, id, false);
        setGranted((g) => {
          const next = new Set(g);
          next.delete(id);
          return next;
        });
        signal.send({ t: 'revoke', to: id });
      } catch (e) {
        failed(e);
      }
    },
  };
}
