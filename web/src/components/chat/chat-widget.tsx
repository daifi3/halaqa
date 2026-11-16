import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Icon } from '@/components/ui/icon';
import { Avatar, IconButton, Spinner } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { alert } from '@/lib/dialog';
import { chatAccent, listTime, previewOf } from '@/lib/direct-chat';
import type { Contact, Conversation } from '@/lib/types';
import { useIsTyping } from '@/lib/use-conversation';
import { useChatWidget } from '@/store/chat-widget';
import { sortedChats, totalUnread, useChats } from '@/store/chats';
import { useMe } from '@/store/session';
import { colors } from '@/theme';
import { ConversationPanel } from './conversation-panel';

/** Opens (or starts) the chat with someone in the floating widget. */
export function useOpenChat() {
  const openConversation = useChatWidget((s) => s.openConversation);
  return async (userId: string) => {
    try {
      const c = await api.openChat(userId);
      useChats.getState().upsertConversation(c);
      openConversation(c.id);
    } catch (e) {
      alert('Couldn’t open the chat', e instanceof Error ? e.message : 'Please try again.');
    }
  };
}

function ChatRow({ c, myId, onOpen }: { c: Conversation; myId: string; onOpen: () => void }) {
  const typing = useIsTyping(useChats((s) => s.typing[c.id] ?? 0));
  const accent = chatAccent(c.theme);
  const unread = c.unread > 0;
  return (
    <Pressable scaleTo={0.99} onClick={onOpen} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 14px', background: 'transparent', textAlign: 'left' }}>
      <Avatar name={c.other.name} size={44} uri={c.other.avatarUrl} ring={unread ? accent : undefined} />
      <span className="v flex1" style={{ gap: 2 }}>
        <span className="h" style={{ gap: 8 }}>
          <Text variant="bodyStrong" lines={1} className="flex1">{c.other.name}</Text>
          <Text variant="small" color={unread ? accent : colors.muted}>{listTime(c.lastMessageAt ?? c.createdAt)}</Text>
        </span>
        <span className="h" style={{ gap: 8 }}>
          <Text variant="small" lines={1} className="flex1" color={typing ? accent : unread ? colors.ink : colors.muted} style={unread ? { fontWeight: 600 } : undefined}>
            {typing ? 'typing…' : previewOf(c.lastMessage, myId)}
          </Text>
          {unread && (
            <span className="h center" style={{ minWidth: 20, height: 20, borderRadius: 10, padding: '0 5px', backgroundColor: accent }}>
              <Text variant="small" color="#fff" style={{ fontSize: 11, fontWeight: 700 }}>{c.unread > 99 ? '99+' : c.unread}</Text>
            </span>
          )}
        </span>
      </span>
    </Pressable>
  );
}

/** "New message": your contacts who are on Halaqa. */
function NewChat({ onPick, onBack }: { onPick: (userId: string) => void; onBack: () => void }) {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    api.listContacts().then((list) => setContacts(list.filter((c) => c.user))).catch(() => setContacts([]));
  }, []);
  const shown = (contacts ?? []).filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="v" style={{ flex: 1, minHeight: 0 }}>
      <div className="h" style={{ gap: 8, padding: '10px 10px 10px 6px', borderBottom: `1px solid ${colors.line}` }}>
        <IconButton icon="chevron-back" size={36} bg="transparent" label="Back" onPress={onBack} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your contacts" aria-label="Search your contacts"
          style={{ flex: 1, border: 0, outline: 0, background: 'transparent', fontSize: 15, color: colors.ink }} />
      </div>
      <div className="v stage-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        {!contacts ? (
          <div className="v center" style={{ padding: 30 }}><Spinner /></div>
        ) : shown.length === 0 ? (
          <Text color={colors.muted} style={{ padding: 24, textAlign: 'center' }}>
            {contacts.length ? 'Nobody matches.' : 'None of your contacts are on Halaqa yet. Add their email in Contacts.'}
          </Text>
        ) : shown.map((c) => (
          <Pressable key={c.id} scaleTo={0.99} onClick={() => onPick(c.user!.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 14px', background: 'transparent', textAlign: 'left' }}>
            <Avatar name={c.name} size={40} uri={c.user?.avatarUrl} />
            <span className="v flex1"><Text variant="bodyStrong" lines={1}>{c.name}</Text><Text variant="small" color={colors.muted} lines={1}>{c.email}</Text></span>
          </Pressable>
        ))}
      </div>
    </div>
  );
}

/**
 * The floating chat at the bottom right of every signed-in page: a round button with
 * the unread count, opening a panel with your chats and the open conversation.
 */
export function ChatWidget() {
  const me = useMe();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { open, conversationId, show, hide, openConversation, backToList } = useChatWidget();
  const conversations = useChats((s) => s.conversations);
  const listLoaded = useChats((s) => s.listLoaded);
  const unread = totalUnread(conversations);
  const [picking, setPicking] = useState(false);
  const openChat = useOpenChat();
  const onTab = ['/', '/courses', '/exams', '/recordings', '/contacts', '/profile'].includes(pathname);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, hide]);

  if (!open) {
    return (
      <button type="button" className={`chat-launcher press${onTab ? ' over-tabbar' : ''}`} onClick={show}
        aria-label={unread ? `Chats, ${unread} unread` : 'Chats'} title="Chats">
        <Icon name="chatbubbles" size={24} color="#fff" />
        {unread > 0 && <span className="chat-launcher-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>
    );
  }

  return (
    <section className="chat-panel" aria-label="Chats">
      {conversationId ? (
        <ConversationPanel id={conversationId} onBack={backToList} onClose={hide} />
      ) : picking ? (
        <NewChat onBack={() => setPicking(false)} onPick={(userId) => { setPicking(false); void openChat(userId); }} />
      ) : (
        <div className="v" style={{ flex: 1, minHeight: 0 }}>
          <div className="h" style={{ gap: 8, padding: '12px 10px 12px 16px', borderBottom: `1px solid ${colors.line}` }}>
            <Text variant="heading" className="flex1">Chats</Text>
            <IconButton icon="create-outline" size={36} bg="transparent" label="New message" onPress={() => setPicking(true)} />
            <IconButton icon="close" size={36} bg="transparent" label="Close chats" onPress={hide} />
          </div>
          <div className="v stage-scroll" style={{ flex: 1, overflowY: 'auto', paddingTop: 4 }}>
            {!listLoaded ? (
              <div className="v center" style={{ padding: 30 }}><Spinner /></div>
            ) : sortedChats(conversations).length === 0 ? (
              <div className="v center" style={{ gap: 10, padding: 28, textAlign: 'center' }}>
                <Icon name="chatbubbles-outline" size={34} color={colors.muted} />
                <Text variant="bodyStrong">No chats yet</Text>
                <Text variant="small" color={colors.muted}>Message any of your contacts who are on Halaqa.</Text>
                <Pressable onClick={() => setPicking(true)} style={{ marginTop: 6, padding: '10px 16px', borderRadius: 999, backgroundColor: colors.primary }}>
                  <Text variant="bodyStrong" color="#fff">New message</Text>
                </Pressable>
                <Pressable hover={false} onClick={() => { hide(); navigate('/contacts'); }} style={{ background: 'transparent' }}>
                  <Text variant="small" color={colors.primary}>Manage contacts</Text>
                </Pressable>
              </div>
            ) : (
              sortedChats(conversations).map((c) => <ChatRow key={c.id} c={c} myId={me.id} onOpen={() => openConversation(c.id)} />)
            )}
          </div>
        </div>
      )}
    </section>
  );
}
