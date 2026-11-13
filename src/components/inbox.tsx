import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { timeAgo } from '@/lib/format';
import type { AppNotification } from '@/lib/types';
import { useInbox } from '@/store/inbox';
import { useSession } from '@/store/session';
import { colors, radius, shadow } from '@/theme';
import { PressableScale } from './ui/pressable-scale';
import { Text } from './ui/text';

type IconName = keyof typeof Ionicons.glyphMap;

const LOOK: Record<AppNotification['kind'], { icon: IconName; color: string; bg: string }> = {
  exam_submitted: { icon: 'ribbon', color: colors.teacher, bg: colors.teacherSoft },
  exam_graded: { icon: 'trophy', color: colors.student, bg: colors.studentSoft },
};

function Count({ n }: { n: number }) {
  if (!n) return null;
  return (
    <View style={styles.count}>
      <Text style={styles.countText} color="#fff">{n > 99 ? '99+' : n}</Text>
    </View>
  );
}

/** The bell in Home's header, with the unread count. */
export function BellButton() {
  const unread = useInbox((s) => s.unread);
  return (
    <PressableScale
      onPress={() => router.push('/inbox')}
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      style={styles.bell}
    >
      <Ionicons name={unread ? 'notifications' : 'notifications-outline'} size={21} color={colors.ink} />
      <View style={{ position: 'absolute', top: 2, right: 0 }}><Count n={unread} /></View>
    </PressableScale>
  );
}

/** One notification: opens its screen and marks it read. */
export function NotificationRow({ n, compact, onOpen }: { n: AppNotification; compact?: boolean; onOpen?: () => void }) {
  const markRead = useInbox((s) => s.markRead);
  const look = LOOK[n.kind] ?? { icon: 'notifications' as IconName, color: colors.ink, bg: colors.surfaceAlt };
  const unread = !n.readAt;

  return (
    <PressableScale
      scaleTo={0.98}
      onPress={() => {
        markRead(n.id);
        onOpen?.();
        if (n.link) router.push(n.link as Href);
      }}
      style={[styles.row, { backgroundColor: compact || !unread ? colors.surface : colors.primarySoft }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: look.bg }]}>
        <Ionicons name={look.icon} size={19} color={look.color} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="bodyStrong" numberOfLines={compact ? 2 : undefined}>{n.title}</Text>
        {!!n.body && <Text variant="small" color={colors.inkSoft} numberOfLines={compact ? 1 : undefined}>{n.body}</Text>}
        <Text variant="small" color={colors.muted}>{timeAgo(n.createdAt)}</Text>
      </View>
      {unread && !compact && <View style={styles.dot} />}
    </PressableScale>
  );
}

/**
 * New notifications as a banner at the top, for when the phone gets no pushes
 * (demo mode, Expo Go). With pushes on, the system shows them instead.
 */
export function InboxBanner() {
  const signedIn = useSession((s) => !!s.user);
  const toasts = useInbox((s) => s.toasts);
  const dismiss = useInbox((s) => s.dismiss);
  const insets = useSafeAreaInsets();
  const top = toasts[0];

  useEffect(() => {
    if (!top) return;
    const t = setTimeout(() => dismiss(top.id), 6000);
    return () => clearTimeout(t);
  }, [top, dismiss]);

  if (!signedIn || !top) return null;
  return (
    <Animated.View key={top.id} entering={FadeInUp.springify()} exiting={FadeOutUp} style={[styles.banner, { top: insets.top + 8 }]}>
      <NotificationRow n={top} compact />
      <Pressable onPress={() => dismiss(top.id)} hitSlop={10} accessibilityLabel="Dismiss" style={styles.close}>
        <Ionicons name="close" size={16} color={colors.muted} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bell: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  count: {
    minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: colors.danger,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface,
  },
  countText: { fontSize: 10, fontWeight: '700', lineHeight: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: radius.lg },
  rowIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 },
  banner: { position: 'absolute', left: 12, right: 12, zIndex: 100, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.float },
  close: { position: 'absolute', top: 10, right: 10, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
});
