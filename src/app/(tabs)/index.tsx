import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RoomCard } from '@/components/room-card';
import { Avatar, EmptyState, Skeleton } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/use-query';
import { useSession } from '@/store/session';
import { colors, radius, shadow } from '@/theme';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function ActionCard({ teacher }: { teacher: boolean }) {
  const tone = teacher ? colors.teacher : colors.student;
  return (
    <Animated.View entering={FadeInDown.delay(60)}>
      <PressableScale
        scaleTo={0.97}
        onPress={() => router.push(teacher ? '/room/new' : '/join')}
        style={[styles.action, { backgroundColor: colors.ink }]}
      >
        <View style={[styles.actionIcon, { backgroundColor: tone }]}>
          <Ionicons name={teacher ? 'add' : 'keypad'} size={24} color="#fff" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading" color="#fff">{teacher ? 'Reserve a room' : 'Join with a code'}</Text>
          <Text variant="small" color="rgba(255,255,255,0.6)">
            {teacher ? 'Schedule a class and invite students' : 'Enter the 6-letter code from your teacher'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
      </PressableScale>
    </Animated.View>
  );
}

export default function Home() {
  const user = useSession((s) => s.user)!;
  const teacher = user.role === 'teacher';
  const { data: rooms, loading, refreshing, refresh, error } = useQuery(() => api.listRooms());

  const active = (rooms ?? []).filter((r) => r.status !== 'ended');
  const live = active.filter((r) => r.status === 'live');
  const upcoming = active.filter((r) => r.status === 'scheduled');

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <Animated.View entering={FadeInUp.duration(400)} style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text color={colors.muted}>{greeting()},</Text>
            <Text variant="title">{user.name.split(' ')[0]}</Text>
          </View>
          <PressableScale onPress={() => router.push('/profile')}>
            <Avatar name={user.name} size={46} ring={teacher ? colors.teacher : colors.student} />
          </PressableScale>
        </Animated.View>

        <ActionCard teacher={teacher} />

        <Animated.View entering={FadeInDown.delay(120)} style={styles.stats}>
          <View style={styles.stat}>
            <Text variant="title">{live.length}</Text>
            <Text variant="small" color={colors.muted}>Live now</Text>
          </View>
          <View style={styles.stat}>
            <Text variant="title">{upcoming.length}</Text>
            <Text variant="small" color={colors.muted}>Upcoming</Text>
          </View>
          <View style={styles.stat}>
            <Text variant="title">{active.reduce((m, r) => m + r.durationMin, 0) / 60 | 0}h</Text>
            <Text variant="small" color={colors.muted}>Planned</Text>
          </View>
        </Animated.View>

        {loading ? (
          <View style={{ gap: 14 }}>
            <Skeleton height={190} />
            <Skeleton height={190} />
          </View>
        ) : error ? (
          <EmptyState icon="cloud-offline-outline" title="Can't reach the server" body={error} />
        ) : active.length === 0 ? (
          <EmptyState
            icon={teacher ? 'calendar-outline' : 'mail-open-outline'}
            title={teacher ? 'No classes yet' : 'No invitations yet'}
            body={teacher ? 'Reserve your first room — it takes ten seconds.' : 'When a teacher invites you, the class appears here.'}
          />
        ) : (
          <View style={{ gap: 14 }}>
            <Text variant="label" color={colors.muted}>Your classes</Text>
            {[...live, ...upcoming].map((room, i) => (
              <RoomCard key={room.id} room={room} index={i} onPress={() => router.push(`/room/${room.id}`)} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 20, paddingBottom: 140 },
  header: { flexDirection: 'row', alignItems: 'center' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: radius.xl, ...shadow.float },
  actionIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 2 },
});
