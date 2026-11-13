import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { CHAT_MAX_LENGTH, type ChatMessage } from '@/lib/chat';
import { formatTime } from '@/lib/format';
import { colors } from '@/theme';

const TEACHER_TINT = '#B9B5FF';
/** Messages from the same person within this window are grouped under one name. */
const GROUP_MS = 2 * 60_000;

function Bubble({ msg, first }: { msg: ChatMessage; first: boolean }) {
  const bg = msg.mine ? colors.primary : msg.teacher ? '#24234A' : colors.stageCard;
  return (
    <div className="v a-down" style={{ alignItems: msg.mine ? 'flex-end' : 'flex-start', marginTop: first ? 10 : 4, animationDuration: '200ms' }}>
      {first && !msg.mine && (
        <div className="h" style={{ gap: 4, margin: '0 0 4px 4px' }}>
          {msg.teacher && <Icon name="school" size={12} color={TEACHER_TINT} />}
          <Text variant="small" color={msg.teacher ? TEACHER_TINT : colors.stageMuted} style={{ fontWeight: 600 }}>
            {msg.author}{msg.teacher ? ' · Teacher' : ''}
          </Text>
        </div>
      )}
      <div className="v" style={{
        maxWidth: '82%', padding: '9px 14px', borderRadius: 18, gap: 2, backgroundColor: bg,
        [msg.mine ? 'borderBottomRightRadius' : 'borderBottomLeftRadius']: 6,
      }}>
        <Text color={msg.mine ? '#fff' : colors.stageText} className="pre">{msg.text}</Text>
        <Text variant="small" color={msg.mine ? 'rgba(255,255,255,0.65)' : colors.stageMuted} style={{ fontSize: 10, lineHeight: '13px', alignSelf: 'flex-end' }}>
          {formatTime(new Date(msg.at).toISOString())}
        </Text>
      </div>
    </div>
  );
}

/** The class chat: a sheet from the bottom on phones, a panel on the right on wide screens. */
export function ChatPanel({ messages, onSend, onClose, docked }: {
  messages: ChatMessage[];
  /** Desktop: a column beside the class instead of a sheet over it. */
  docked?: boolean;
  onSend: (text: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const canSend = draft.trim().length > 0;

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function send() {
    if (!canSend) return;
    onSend(draft.trim());
    setDraft('');
  }

  const sheet = (
      <div className={docked ? 'chat-dock' : 'chat-sheet'} role={docked ? 'complementary' : 'dialog'} aria-label="Class chat">
        <div className="h" style={{ gap: 12, padding: '18px 20px 12px', borderBottom: `1px solid ${colors.stageLine}` }}>
          <div className="v flex1">
            <Text variant="heading" color={colors.stageText}>Class chat</Text>
            <Text variant="small" color={colors.stageMuted}>Everyone in the session can see these messages</Text>
          </div>
          <IconButton icon="close" size={38} color={colors.stageText} bg={colors.stageCard} onPress={onClose} label="Close chat" />
        </div>

        <div ref={list} className="v stage-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 16px 12px' }}>
          {messages.length === 0 ? (
            <div className="v flex1 center" style={{ gap: 10, padding: '40px 0' }}>
              <Icon name="chatbubbles-outline" size={30} color={colors.stageMuted} />
              <Text color={colors.stageMuted} style={{ textAlign: 'center' }}>No messages yet.<br />Ask a question or say hello.</Text>
            </div>
          ) : (
            messages.map((m, i) => {
              const prev = messages[i - 1];
              const first = !prev || prev.authorId !== m.authorId || prev.mine !== m.mine || m.at - prev.at > GROUP_MS;
              return <Bubble key={m.id} msg={m} first={first} />;
            })
          )}
        </div>

        <div className="h" style={{ alignItems: 'flex-end', gap: 10, padding: '10px 16px max(env(safe-area-inset-bottom), 12px)', borderTop: `1px solid ${colors.stageLine}` }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Message the class…"
            maxLength={CHAT_MAX_LENGTH}
            rows={1}
            autoFocus
            style={{
              flex: 1, minHeight: 44, maxHeight: 110, borderRadius: 22, backgroundColor: colors.stageCard, color: colors.stageText,
              padding: '12px 16px', fontSize: 15, border: 0, outline: 0, resize: 'none',
            }}
          />
          <Pressable scaleTo={0.88} disabled={!canSend} onClick={send} aria-label="Send message"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: canSend ? colors.primary : colors.stageCard, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="arrow-up" size={20} color="#fff" />
          </Pressable>
        </div>
      </div>
  );
  if (docked) return sheet;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 20 }}>
      <div className="a-fade" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)' }} onClick={onClose} aria-label="Close chat" />
      {sheet}
    </div>
  );
}
