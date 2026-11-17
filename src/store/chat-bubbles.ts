import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Most bubbles on screen at once; the oldest goes when another arrives. */
export const MAX_BUBBLES = 4;

/**
 * In-app chat bubbles ("chat heads"): chats that float over the app as round photos,
 * opening in a panel over whatever screen you're on. Turned on in a chat's settings.
 */
interface ChatBubblesState {
  enabled: boolean;
  /** Conversation ids, newest first. */
  bubbles: string[];
  /** The chat open in the bubble panel, or null when the bubbles are collapsed. */
  open: string | null;
  setEnabled: (on: boolean) => void;
  /** Adds (or moves to the front) a chat's bubble. */
  add: (conversationId: string) => void;
  remove: (conversationId: string) => void;
  clear: () => void;
  setOpen: (conversationId: string | null) => void;
}

export const useChatBubbles = create<ChatBubblesState>()(
  persist(
    (set) => ({
      enabled: false,
      bubbles: [],
      open: null,
      setEnabled: (on) => set(on ? { enabled: true } : { enabled: false, bubbles: [], open: null }),
      add: (id) => set((s) => ({ bubbles: [id, ...s.bubbles.filter((b) => b !== id)].slice(0, MAX_BUBBLES) })),
      remove: (id) => set((s) => {
        const bubbles = s.bubbles.filter((b) => b !== id);
        return { bubbles, open: s.open === id ? (bubbles[0] ?? null) : s.open };
      }),
      clear: () => set({ bubbles: [], open: null }),
      setOpen: (id) => set({ open: id }),
    }),
    {
      name: 'halaqa-chat-bubbles',
      storage: createJSONStorage(() => AsyncStorage),
      // Bubbles stay across restarts like on a phone's home screen; the panel always starts closed.
      partialize: ({ enabled, bubbles }) => ({ enabled, bubbles }),
    },
  ),
);
