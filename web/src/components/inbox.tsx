import { useEffect, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router';
import { formatDay, timeAgo } from '@/lib/format';
import type { AppNotification } from '@/lib/types';
import { useInbox } from '@/store/inbox';
import { useSession } from '@/store/session';
import { colors, radius } from '@/theme';
import { Icon, type IconName } from './ui/icon';
import { Pressable } from './ui/pressable';
import { Text } from './ui/text';

const POLL_MS = 30_000;

const LOOK: Record<AppNotification['kind'], { icon: IconName; color: string; bg: string }> = {
  exam_submitted: { icon: 'ribbon', color: colors.teacher, bg: colors.teacherSoft },
  exam_graded: { icon: 'trophy', color: colors.student, bg: colors.studentSoft },
};

/** Keeps the bell fresh while signed in: now, every 30 s, and whenever the tab comes back. */
export function useInboxPolling() {
  const userId = useSession((s) => s.user?.id);
  useEffect(() => {
    const { reset, refresh } = useInbox.getState();
    reset();
    if (!userId) return;
    void refresh();
    const timer = setInterval(() => void useInbox.getState().refresh(), POLL_MS);
    const onShow = () => { if (!document.hidden) void useInbox.getState().refresh(); };
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onShow);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('focus', onShow);
    };
  }, [userId]);
}

function Count({ n, style }: { n: number; style?: CSSProperties }) {
  if (!n) return null;
  return <span className="inbox-count" style={style}>{n > 99 ? '99+' : n}</span>;
}

/** Phones: the bell in a page header. */
export function BellButton() {
  const unread = useInbox((s) => s.unread);
  const navigate = useNavigate();
  return (
    <Pressable onClick={() => navigate('/inbox')} scaleTo={0.9} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      style={{ position: 'relative', width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'center' }}>
      <Icon name={unread ? 'notifications' : 'notifications-outline'} size={21} color={colors.ink} />
      <Count n={unread} style={{ position: 'absolute', top: 2, right: 0 }} />
    </Pressable>
  );
}

/** Desktop: the sidebar entry above the account. */
export function SidebarInboxLink({ active }: { active: boolean }) {
  const unread = useInbox((s) => s.unread);
  return (
    <Link to="/inbox" className={`tab press${active ? ' on' : ''}`} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      style={{ ['--press-scale' as string]: 0.97, marginBottom: 6 }}>
      <Icon name={active || unread ? 'notifications' : 'notifications-outline'} size={20} />
      <span className="tab-label flex1">Notifications</span>
      <Count n={unread} />
    </Link>
  );
}

/** One notification: opens its screen and marks it read. */
export function NotificationRow({ n, compact, onOpen }: { n: AppNotification; compact?: boolean; onOpen?: () => void }) {
  const navigate = useNavigate();
  const markRead = useInbox((s) => s.markRead);
  const look = LOOK[n.kind] ?? { icon: 'notifications' as IconName, color: colors.ink, bg: colors.surfaceAlt };
  const unread = !n.readAt;

  return (
    <Pressable
      scaleTo={0.98}
      onClick={() => {
        markRead(n.id);
        onOpen?.();
        if (n.link) navigate(n.link);
      }}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%', textAlign: 'left',
        padding: compact ? 12 : 14, borderRadius: radius.lg,
        backgroundColor: compact || !unread ? colors.surface : colors.primarySoft,
      }}
    >
      <span className="h center" style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: look.bg, flexShrink: 0 }}>
        <Icon name={look.icon} size={19} color={look.color} />
      </span>
      <span className="v flex1" style={{ gap: 3, minWidth: 0 }}>
        <Text variant="bodyStrong" lines={compact ? 2 : undefined}>{n.title}</Text>
        {n.body && <Text variant="small" color={colors.inkSoft} lines={compact ? 1 : undefined}>{n.body}</Text>}
        <Text variant="small" color={colors.muted} title={`${formatDay(n.createdAt)} ${new Date(n.createdAt).toLocaleTimeString()}`}>
          {timeAgo(n.createdAt)}
        </Text>
      </span>
      {unread && !compact && <span style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6, flexShrink: 0 }} aria-label="Unread" />}
    </Pressable>
  );
}

/** New notifications pop up for a few seconds (desktop: bottom right, phones: top). */
export function InboxToasts() {
  const toasts = useInbox((s) => s.toasts);
  const dismiss = useInbox((s) => s.dismiss);

  useEffect(() => {
    if (!toasts.length) return;
    const oldest = toasts[toasts.length - 1]!;
    const t = setTimeout(() => dismiss(oldest.id), 8000);
    return () => clearTimeout(t);
  }, [toasts, dismiss]);

  if (!toasts.length) return null;
  return (
    <div className="inbox-toasts" role="status" aria-live="polite">
      {toasts.map((n) => (
        <div key={n.id} className="inbox-toast a-down">
          <NotificationRow n={n} compact />
          <button type="button" className="inbox-toast-close" aria-label="Dismiss" onClick={() => dismiss(n.id)}>
            <Icon name="close" size={16} color={colors.muted} />
          </button>
        </div>
      ))}
    </div>
  );
}
