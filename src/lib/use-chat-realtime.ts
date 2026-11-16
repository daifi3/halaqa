import { Room, RoomEvent } from 'livekit-client';
import { useEffect } from 'react';
import { refreshChats, useChats } from '@/store/chats';
import { useSession } from '@/store/session';
import { api } from './api';
import { config } from './config';
import { CHAT_TOPIC, decodeChatEvent, onDemoChat } from './direct-chat';

/** Wait before trying again after the inbox connection drops (doubles up to a minute). */
const RETRY_MS = 3000;

/**
 * Keeps this app connected to its user's LiveKit inbox room while signed in, and feeds
 * the chat events the server sends there into the chat store. Data only: no microphone,
 * no camera, nothing published. Mount once, where the signed-in app lives.
 */
export function useChatRealtime() {
  const myId = useSession((s) => s.user?.id);

  useEffect(() => {
    if (!myId) return;
    const apply = useChats.getState().applyEvent;
    void refreshChats();
    if (config.useMock) return onDemoChat((e) => apply(e, myId));

    let room: Room | null = null;
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let wait = RETRY_MS;

    const schedule = () => {
      if (stopped) return;
      clearTimeout(retry);
      retry = setTimeout(connect, wait);
      wait = Math.min(wait * 2, 60_000);
    };

    async function connect() {
      try {
        const creds = await api.getChatRealtimeToken();
        if (stopped) return;
        const r = new Room({ adaptiveStream: false, dynacast: false });
        room = r;
        r.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
          if (topic !== CHAT_TOPIC) return;
          const e = decodeChatEvent(payload);
          if (e) apply(e, myId!);
        });
        // LiveKit retries short drops itself; this is for when it gives up (or the token expires).
        r.on(RoomEvent.Disconnected, () => { if (room === r) schedule(); });
        r.on(RoomEvent.Reconnected, () => void refreshChats());
        await r.connect(creds.serverUrl, creds.token, { autoSubscribe: false });
        wait = RETRY_MS;
        // Catch up on anything sent while we weren't listening.
        void refreshChats();
      } catch {
        schedule();
      }
    }

    void connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      const r = room;
      room = null;
      void r?.disconnect();
      useChats.getState().reset();
    };
  }, [myId]);
}
