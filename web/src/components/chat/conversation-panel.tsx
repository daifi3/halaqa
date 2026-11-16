import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/ui/icon';
import { Avatar, IconButton, Spinner } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import {
  CHAT_REACTIONS, CHAT_THEMES, chatAccent, clockTime, dayLabel, formatBytes, isImage, sameDay,
} from '@/lib/direct-chat';
import { viewerKind, viewerPath } from '@/lib/links';
import { useStartCall } from '@/lib/use-calls';
import { useConversation, useIsTyping } from '@/lib/use-conversation';
import type { ChatItem } from '@/store/chats';
import { colors, isDark, radius } from '@/theme';

/** Messages closer than this (same sender) share one group: one time label, tighter corners. */
const GROUP_MS = 5 * 60_000;
/** The server's upload limit. */
const MAX_FILE_BYTES = 50 * 1024 * 1024;

function Attachment({ m, mine }: { m: ChatItem; mine: boolean }) {
  const navigate = useNavigate();
  const a = m.attachment!;
  const open = () => {
    if (m.status) return;
    const kind = viewerKind(a.mimeType, a.url);
    if (kind) navigate(viewerPath({ url: a.url, title: a.name, kind }));
    else window.open(a.url, '_blank', 'noopener');
  };
  if (isImage(a)) {
    return (
      <button type="button" onClick={open} aria-label={`Open photo ${a.name}`} style={{ padding: 0, border: 0, background: 'none', cursor: 'zoom-in', display: 'block' }}>
        <img src={a.url} alt={a.name} style={{ width: 220, maxWidth: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 14, display: 'block', backgroundColor: colors.surfaceAlt }} />
      </button>
    );
  }
  return (
    <button type="button" onClick={open} className="h" style={{
      gap: 10, padding: 10, borderRadius: 12, border: 0, cursor: 'pointer', minWidth: 180, textAlign: 'left',
      backgroundColor: mine ? 'rgba(255,255,255,0.16)' : colors.surfaceAlt,
    }}>
      <Icon name="document-text" size={22} color={mine ? '#fff' : colors.primary} />
      <span className="v" style={{ minWidth: 0 }}>
        <Text variant="bodyStrong" color={mine ? '#fff' : colors.ink} lines={1}>{a.name}</Text>
        {!!a.size && <Text variant="small" color={mine ? 'rgba(255,255,255,0.75)' : colors.muted}>{formatBytes(a.size)}</Text>}
      </span>
    </button>
  );
}

function TypingBubble() {
  return (
    <div className="h a-fade" style={{ gap: 4, padding: '12px 14px', borderRadius: 20, backgroundColor: colors.surface, alignSelf: 'flex-start', marginTop: 8 }} aria-label="typing">
      {[0, 1, 2].map((i) => <span key={i} className="typing-dot" style={{ animationDelay: `${i * 160}ms`, backgroundColor: colors.muted }} />)}
    </div>
  );
}

function Bubble({ m, first, last, mine, accent, seen, myId, onReact, onRetry }: {
  m: ChatItem; first: boolean; last: boolean; mine: boolean; accent: string; seen: boolean; myId: string;
  onReact: (emoji: string) => void; onRetry: () => void;
}) {
  const [picker, setPicker] = useState(false);
  const photoOnly = !!m.attachment && isImage(m.attachment) && !m.text;
  const counts = new Map<string, number>();
  m.reactions.forEach((r) => counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1));
  const myReaction = m.reactions.find((r) => r.userId === myId)?.emoji;
  const r = 18;

  return (
    <div className="v chat-msg" style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginTop: first ? 10 : 2, position: 'relative' }}>
      <div className="h" style={{ gap: 6, flexDirection: mine ? 'row-reverse' : 'row', maxWidth: '100%' }}>
        <div
          onContextMenu={(e) => { if (!m.status) { e.preventDefault(); setPicker(true); } }}
          title={new Date(m.createdAt).toLocaleString()}
          style={{
            maxWidth: 260, padding: photoOnly ? 4 : '8px 13px', wordBreak: 'break-word',
            backgroundColor: mine ? accent : colors.surface, opacity: m.status === 'sending' ? 0.7 : 1,
            borderRadius: r,
            [mine ? 'borderBottomRightRadius' : 'borderBottomLeftRadius']: last ? 6 : r,
            [mine ? 'borderTopRightRadius' : 'borderTopLeftRadius']: first ? r : 6,
          }}
        >
          {m.attachment && <Attachment m={m} mine={mine} />}
          {!!m.text && <Text color={mine ? '#fff' : colors.ink} className="pre" style={{ display: 'block', marginTop: m.attachment ? 6 : 0, userSelect: 'text' }}>{m.text}</Text>}
        </div>
        {!m.status && (
          <button type="button" className="chat-react-btn" aria-label="React" onClick={() => setPicker((v) => !v)}>
            <Icon name="happy-outline" size={18} color={colors.muted} />
          </button>
        )}
      </div>

      {picker && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 1 }} onClick={() => setPicker(false)} aria-hidden />
          <div className="h a-zoom" role="menu" aria-label="Reactions" style={{
            position: 'absolute', bottom: '100%', [mine ? 'right' : 'left']: 0, zIndex: 2, gap: 2, padding: 4,
            backgroundColor: colors.surface, borderRadius: 999, boxShadow: 'var(--shadow-float)', marginBottom: 4,
          }}>
            {CHAT_REACTIONS.map((e) => (
              <button key={e} type="button" role="menuitem" className="chat-emoji" aria-label={`React ${e}`}
                onClick={() => { onReact(e); setPicker(false); }}
                style={{ backgroundColor: myReaction === e ? accent + '33' : 'transparent' }}>{e}</button>
            ))}
          </div>
        </>
      )}

      {counts.size > 0 && (
        <div className="h" style={{ gap: 4, marginTop: -6, [mine ? 'marginRight' : 'marginLeft']: 6, position: 'relative' }}>
          {[...counts].map(([emoji, n]) => (
            <button key={emoji} type="button" onClick={() => onReact(emoji)} aria-label={`${emoji} ${n}`} style={{
              fontSize: 12, padding: '1px 7px', borderRadius: 999, cursor: 'pointer', backgroundColor: colors.surface,
              border: `1.5px solid ${myReaction === emoji ? accent : colors.line}`, color: colors.ink,
            }}>{emoji}{n > 1 ? ` ${n}` : ''}</button>
          ))}
        </div>
      )}

      {m.status === 'failed' ? (
        <button type="button" onClick={onRetry} className="h" style={{ gap: 4, marginTop: 3, border: 0, background: 'none', cursor: 'pointer', padding: '0 6px' }}>
          <Icon name="alert-circle" size={13} color={colors.danger} />
          <Text variant="small" color={colors.danger}>Not sent · retry</Text>
        </button>
      ) : last ? (
        <div className="h" style={{ gap: 4, marginTop: 3, padding: '0 6px' }}>
          <Text variant="small" color={colors.muted} style={{ fontSize: 11 }}>{clockTime(m.createdAt)}</Text>
          {mine && (m.status === 'sending'
            ? <Icon name="time-outline" size={12} color={colors.muted} />
            : <Icon name={seen ? 'checkmark-done' : 'checkmark'} size={14} color={seen ? accent : colors.muted} />)}
          {mine && seen && !m.status && <Text variant="small" color={accent} style={{ fontSize: 11 }}>Seen</Text>}
        </div>
      ) : null}
    </div>
  );
}

function ThemeMenu({ current, onPick, onClose }: { current: string; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, zIndex: 3 }} onClick={onClose} aria-hidden />
      <div className="v a-down" role="dialog" aria-label="Chat theme" style={{
        position: 'absolute', top: 60, right: 10, left: 10, zIndex: 4, padding: 14, gap: 10, borderRadius: radius.lg,
        backgroundColor: colors.surface, boxShadow: 'var(--shadow-float)',
      }}>
        <div className="v" style={{ gap: 2 }}>
          <Text variant="bodyStrong">Chat theme</Text>
          <Text variant="small" color={colors.muted}>You both see the theme you pick.</Text>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {CHAT_THEMES.map((t) => {
            const on = t.id === current;
            return (
              <Pressable key={t.id} hover={false} scaleTo={0.92} onClick={() => { onPick(t.id); onClose(); }} aria-pressed={on}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'transparent' }}>
                <span className="h center" style={{
                  width: 46, height: 46, borderRadius: 23, backgroundColor: chatAccent(t.id), fontSize: 18,
                  outline: on ? `3px solid ${colors.ink}` : 'none', outlineOffset: 2,
                }}>{t.emoji}</span>
                <Text variant="small" color={on ? colors.ink : colors.muted}>{t.name}</Text>
              </Pressable>
            );
          })}
        </div>
      </div>
    </>
  );
}

/** Whether this browser tab is in front — messages only count as read while it is. */
function usePageVisible() {
  const [visible, setVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const on = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return visible;
}

/** One chat inside the floating widget. */
export function ConversationPanel({ id, onBack, onClose }: { id: string; onBack: () => void; onClose: () => void }) {
  const chat = useConversation(id, usePageVisible());
  const typing = useIsTyping(chat.typingUntil);
  const startCall = useStartCall();
  const [draft, setDraft] = useState('');
  const [themes, setThemes] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const restoreFrom = useRef<number | null>(null);
  const accent = chatAccent(chat.conversation?.theme);
  const other = chat.conversation?.other;
  const otherReadAt = chat.conversation?.otherReadAt ?? null;

  const seenId = useMemo(() => {
    if (!otherReadAt) return null;
    return chat.messages.filter((m) => m.senderId === chat.myId && !m.status && m.createdAt <= otherReadAt).at(-1)?.id ?? null;
  }, [chat.messages, chat.myId, otherReadAt]);

  // Stay at the newest message unless the user scrolled up; keep the place when older ones load above.
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    if (restoreFrom.current !== null) {
      el.scrollTop = el.scrollHeight - restoreFrom.current;
      restoreFrom.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [chat.messages, typing, chat.loading]);

  useEffect(() => { input.current?.focus(); }, [id]);

  function onScroll() {
    const el = list.current!;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (el.scrollTop < 80 && chat.hasMore && !chat.loadingOlder) {
      restoreFrom.current = el.scrollHeight - el.scrollTop;
      void chat.loadOlder();
    }
  }

  function send() {
    if (!draft.trim()) return;
    stickToBottom.current = true;
    chat.send(draft);
    setDraft('');
  }

  function sendFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_BYTES) {
        setNotice(`${file.name} is over 50 MB`);
        continue;
      }
      stickToBottom.current = true;
      chat.sendFile({ uri: URL.createObjectURL(file), name: file.name, mimeType: file.type || 'application/octet-stream', file }, draft || undefined);
      if (draft) setDraft('');
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) sendFiles(e.dataTransfer.files);
  }

  return (
    <div className="v" style={{ flex: 1, minHeight: 0, position: 'relative' }}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
      onDrop={onDrop}>
      <div className="h" style={{ gap: 8, padding: '10px 10px 10px 6px', borderBottom: `1px solid ${colors.line}`, backgroundColor: colors.surface }}>
        <IconButton icon="chevron-back" size={36} bg="transparent" label="All chats" onPress={onBack} />
        {other && <Avatar name={other.name} size={36} uri={other.avatarUrl} />}
        <div className="v flex1">
          <Text variant="bodyStrong" lines={1}>{other?.name ?? ' '}</Text>
          <Text variant="small" color={typing ? accent : colors.muted}>{typing ? 'typing…' : 'Halaqa chat'}</Text>
        </div>
        <IconButton icon="color-palette-outline" size={36} color={accent} bg="transparent" label="Chat theme" onPress={() => setThemes(true)} />
        {other && <IconButton icon="call" size={36} color="#fff" bg={colors.success} label={`Call ${other.name}`} onPress={() => startCall(other)} />}
        <IconButton icon="close" size={36} bg="transparent" label="Close chat" onPress={onClose} />
      </div>

      {themes && <ThemeMenu current={chat.conversation?.theme ?? 'default'} onPick={(t) => void chat.setTheme(t)} onClose={() => setThemes(false)} />}

      <div ref={list} onScroll={onScroll} className="v stage-scroll" role="log" aria-live="polite"
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 12px 12px', backgroundColor: colors.bg, backgroundImage: `linear-gradient(${accent}${isDark ? '14' : '0D'}, ${accent}${isDark ? '14' : '0D'})` }}>
        {chat.loading ? (
          <div className="v center flex1"><Spinner /></div>
        ) : chat.error ? (
          <div className="v center flex1" style={{ gap: 8, padding: 24 }}><Text color={colors.muted}>{chat.error}</Text></div>
        ) : (
          <>
            {chat.loadingOlder && <div className="v center" style={{ padding: 8 }}><Spinner size={16} /></div>}
            {chat.messages.length === 0 && other && (
              <div className="v center flex1" style={{ gap: 8, padding: 24, textAlign: 'center' }}>
                <Avatar name={other.name} size={64} uri={other.avatarUrl} />
                <Text variant="heading">{other.name}</Text>
                <Text color={colors.muted}>Say hello 👋 Messages and files here are only between you two.</Text>
              </div>
            )}
            {chat.messages.map((m, i) => {
              const prev = chat.messages[i - 1];
              const next = chat.messages[i + 1];
              const newDay = !prev || !sameDay(prev.createdAt, m.createdAt);
              const joinsPrev = !newDay && prev!.senderId === m.senderId && Date.parse(m.createdAt) - Date.parse(prev!.createdAt) < GROUP_MS;
              const joinsNext = !!next && next.senderId === m.senderId && sameDay(next.createdAt, m.createdAt)
                && Date.parse(next.createdAt) - Date.parse(m.createdAt) < GROUP_MS;
              return (
                <Fragment key={m.clientId || m.id}>
                  {newDay && (
                    <span style={{ alignSelf: 'center', margin: '12px 0 4px', padding: '3px 12px', borderRadius: 999, backgroundColor: colors.surface }}>
                      <Text variant="small" color={colors.muted} style={{ fontWeight: 600 }}>{dayLabel(m.createdAt)}</Text>
                    </span>
                  )}
                  <Bubble m={m} first={!joinsPrev} last={!joinsNext} mine={m.senderId === chat.myId} accent={accent}
                    seen={m.id === seenId} myId={chat.myId} onReact={(e) => void chat.react(m, e)} onRetry={() => chat.retry(m.clientId)} />
                </Fragment>
              );
            })}
            {typing && <TypingBubble />}
          </>
        )}
      </div>

      {notice && (
        <button type="button" onClick={() => setNotice(null)} className="h" style={{ gap: 6, padding: '6px 12px', border: 0, backgroundColor: colors.dangerSoft, cursor: 'pointer' }}>
          <Icon name="alert-circle" size={14} color={colors.danger} />
          <Text variant="small" color={colors.danger} className="flex1" style={{ textAlign: 'left' }}>{notice}</Text>
          <Icon name="close" size={14} color={colors.danger} />
        </button>
      )}

      <div className="h" style={{ gap: 8, padding: 10, alignItems: 'flex-end', borderTop: `1px solid ${colors.line}`, backgroundColor: colors.surface }}>
        <IconButton icon="attach" size={40} color={accent} bg={accent + '1A'} label="Send a file" onPress={() => fileInput.current?.click()} />
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => { if (e.target.files) sendFiles(e.target.files); e.target.value = ''; }} />
        <textarea
          ref={input}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); if (e.target.value.trim()) chat.typing(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); sendFiles(e.clipboardData.files); } }}
          placeholder="Message…"
          aria-label="Message"
          maxLength={4000}
          rows={1}
          style={{
            flex: 1, minHeight: 40, maxHeight: 120, borderRadius: 20, backgroundColor: colors.surfaceAlt, color: colors.ink,
            padding: '10px 14px', fontSize: 15, border: 0, outline: 0, resize: 'none', fieldSizing: 'content',
          } as React.CSSProperties}
        />
        <Pressable scaleTo={0.88} disabled={!draft.trim()} onClick={send} aria-label="Send message" style={{
          width: 40, height: 40, borderRadius: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: draft.trim() ? accent : colors.surfaceAlt,
        }}>
          <Icon name="arrow-up" size={20} color={draft.trim() ? '#fff' : colors.muted} />
        </Pressable>
      </div>

      {dragging && (
        <div className="v center a-fade" style={{ position: 'absolute', inset: 0, zIndex: 5, backgroundColor: accent + 'E6', gap: 8, pointerEvents: 'none' }}>
          <Icon name="cloud-upload-outline" size={36} color="#fff" />
          <Text variant="bodyStrong" color="#fff">Drop to send</Text>
        </div>
      )}
    </div>
  );
}
