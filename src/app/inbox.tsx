import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NotificationRow } from '@/components/inbox';
import { EmptyState, IconButton, Skeleton } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { useInbox } from '@/store/inbox';
import { useSession } from '@/store/session';
import { colors } from '@/theme';

export default function InboxScreen() {
  const teacher = useSession((s) => s.user?.role === 'teacher');
  const items = useInbox((s) => s.items);
  const unread = useInbox((s) => s.unread);
  const loaded = useInbox((s) => s.loaded);
  const markAllRead = useInbox((s) => s.markAllRead);
  const [refreshing, setRefreshing] = useState(false);

  // Opening the list counts as a fresh look.
  useEffect(() => { void useInbox.getState().refresh(); }, []);

  async function pull() {
    setRefreshing(true);
    await useInbox.getState().refresh();
    setRefreshing(false);
  }

  const fresh = items.filter((n) => !n.readAt);
  const earlier = items.filter((n) => n.readAt);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => router.back()} />
        <IconButton icon="settings-outline" onPress={() => router.push('/notifications')} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={colors.primary} />}
      >
        <Animated.View entering={FadeInUp.duration(400)} style={{ gap: 4 }}>
          <Text variant="title">Notifications</Text>
          <Text color={colors.muted}>
            {unread ? `${unread} unread` : teacher ? 'Exam submissions from your students' : 'Grades from your teachers'}
          </Text>
        </Animated.View>

        {!loaded ? (
          <View style={{ gap: 10 }}><Skeleton height={76} /><Skeleton height={76} /><Skeleton height={76} /></View>
        ) : items.length === 0 ? (
          <EmptyState
            icon="notifications-outline"
            title="Nothing yet"
            body={teacher ? 'You’ll see here when a student finishes one of your exams.' : 'You’ll see here when a teacher releases your exam grade.'}
          />
        ) : (
          <>
            {fresh.length > 0 && (
              <Animated.View entering={FadeInDown.delay(60)} style={{ gap: 8 }}>
                <View style={styles.sectionHead}>
                  <Text variant="label" color={colors.muted}>New</Text>
                  <PressableScale onPress={markAllRead} hitSlop={8}>
                    <Text variant="small" color={colors.primary} style={{ fontWeight: '700' }}>Mark all as read</Text>
                  </PressableScale>
                </View>
                {fresh.map((n) => <NotificationRow key={n.id} n={n} />)}
              </Animated.View>
            )}
            {earlier.length > 0 && (
              <Animated.View entering={FadeInDown.delay(120)} style={{ gap: 8 }}>
                <Text variant="label" color={colors.muted}>Earlier</Text>
                {earlier.map((n) => <NotificationRow key={n.id} n={n} />)}
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  content: { padding: 20, gap: 20, paddingBottom: 40 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
