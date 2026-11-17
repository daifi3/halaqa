import { router, useLocalSearchParams } from 'expo-router';
import { ChatView } from '@/components/chat/chat-view';

/** A chat on its own page. The same view opens from a chat bubble (components/chat/chat-bubbles). */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChatView id={id} onClose={() => router.back()} />;
}
