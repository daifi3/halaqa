import { create } from 'zustand';

/** The floating chat at the bottom right: closed, the list of chats, or one chat. */
interface ChatWidgetState {
  open: boolean;
  conversationId: string | null;
  show: () => void;
  hide: () => void;
  openConversation: (id: string) => void;
  backToList: () => void;
}

export const useChatWidget = create<ChatWidgetState>()((set) => ({
  open: false,
  conversationId: null,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
  openConversation: (id) => set({ open: true, conversationId: id }),
  backToList: () => set({ conversationId: null }),
}));
