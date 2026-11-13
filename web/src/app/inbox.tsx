import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { NotificationRow } from '@/components/inbox';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { delay, EmptyState, IconButton, Skeleton } from '@/components/ui/misc';
import { PageHeader, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useInbox } from '@/store/inbox';
import { useIsTeacher } from '@/store/session';
import { colors, radius } from '@/theme';

type Permission = NotificationPermission | 'unsupported';
const currentPermission = (): Permission => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

/** Offers system alerts while Halaqa is in a background tab. */
function DesktopAlerts() {
  const [permission, setPermission] = useState<Permission>(currentPermission);
  if (permission !== 'default') return null;
  return (
    <div className="h a-down" style={{ ...delay(40), gap: 12, padding: '14px 16px', backgroundColor: colors.surface, borderRadius: radius.lg, flexWrap: 'wrap' }}>
      <span className="h center" style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.ink, flexShrink: 0 }}>
        <Icon name="desktop-outline" size={18} color="#fff" />
      </span>
      <div className="v flex1" style={{ gap: 2, minWidth: 200 }}>
        <Text variant="bodyStrong">Alerts on this computer</Text>
        <Text variant="small" color={colors.muted}>Get a system notification even when Halaqa is in another tab.</Text>
      </div>
      <Button size="md" variant="secondary" title="Turn on" onPress={() => {
        void Notification.requestPermission().then(setPermission);
      }} />
    </div>
  );
}

export default function InboxScreen() {
  const navigate = useNavigate();
  const teacher = useIsTeacher();
  const items = useInbox((s) => s.items);
  const unread = useInbox((s) => s.unread);
  const loaded = useInbox((s) => s.loaded);
  const markAllRead = useInbox((s) => s.markAllRead);

  // Opening the list counts as a fresh look.
  useEffect(() => { void useInbox.getState().refresh(); }, []);

  const fresh = items.filter((n) => !n.readAt);
  const earlier = items.filter((n) => n.readAt);
  const settings = <IconButton icon="settings-outline" label="Notification settings" onPress={() => navigate('/notifications')} />;

  return (
    <Screen right={<span className="mobile-only">{settings}</span>} style={{ gap: 20, paddingBottom: 40 }}>
      <div className="v settings-col" style={{ gap: 20 }}>
        <PageHeader
          title="Notifications"
          subtitle={unread ? `${unread} unread` : teacher ? 'Exam submissions from your students' : 'Grades from your teachers'}
          actions={
            <>
              <Button size="md" variant="secondary" icon="settings-outline" title="Settings" onPress={() => navigate('/notifications')} />
              <Button size="md" icon="checkmark-done" title="Mark all as read" disabled={!unread} onPress={markAllRead} />
            </>
          }
        />

        <DesktopAlerts />

        {!loaded ? (
          <div className="v" style={{ gap: 10 }}><Skeleton height={76} /><Skeleton height={76} /><Skeleton height={76} /></div>
        ) : items.length === 0 ? (
          <EmptyState
            icon="notifications-outline"
            title="Nothing yet"
            body={teacher ? 'You’ll see here when a student finishes one of your exams.' : 'You’ll see here when a teacher releases your exam grade.'}
          />
        ) : (
          <>
            {fresh.length > 0 && (
              <div className="v a-down" style={{ ...delay(60), gap: 8 }}>
                <div className="h" style={{ justifyContent: 'space-between' }}>
                  <Text variant="label" color={colors.muted}>New</Text>
                  <span className="mobile-only">
                    <Button size="md" variant="ghost" title="Mark all as read" onPress={markAllRead} />
                  </span>
                </div>
                {fresh.map((n) => <NotificationRow key={n.id} n={n} />)}
              </div>
            )}
            {earlier.length > 0 && (
              <div className="v a-down" style={{ ...delay(120), gap: 8 }}>
                <Text variant="label" color={colors.muted}>Earlier</Text>
                {earlier.map((n) => <NotificationRow key={n.id} n={n} />)}
              </div>
            )}
          </>
        )}
      </div>
    </Screen>
  );
}
