import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChoiceRow } from '@/components/ui/choice';
import { Avatar, Chip, EmptyState, IconButton, Skeleton } from '@/components/ui/misc';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { RSVP_STYLE } from '@/lib/rsvp';
import type { RoomStudent, RsvpStatus } from '@/lib/types';
import { useQuery } from '@/lib/use-query';
import { colors, radius, shadow } from '@/theme';

type Filter = 'all' | RsvpStatus;

const SOURCE_LABEL: Record<RoomStudent['source'], string> = {
  invite: 'Invited',
  course: 'Course roster',
  code: 'Joined with code',
};

function StudentRow({ student, index }: { student: RoomStudent; index: number }) {
  const s = RSVP_STYLE[student.status];
  return (
    <Animated.View entering={FadeInDown.delay(60 + index * 40)} layout={LinearTransition.springify()} style={styles.row}>
      <Avatar name={student.name ?? student.email} size={40} uri={student.avatarUrl} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" numberOfLines={1}>{student.name ?? student.email}</Text>
        <Text variant="small" color={colors.muted} numberOfLines={1}>
          {student.name ? student.email : 'No account yet'} · {SOURCE_LABEL[student.source]}
        </Text>
      </View>
      <Chip label={s.label} icon={s.icon} color={s.fg} bg={s.bg} />
    </Animated.View>
  );
}

export default function RoomStudents() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, refreshing, refresh } = useQuery(() =>
    Promise.all([api.getRoom(id), api.listRoomStudents(id)]).then(([room, students]) => ({ room, students })),
  );
  const [filter, setFilter] = useState<Filter>('all');

  const students = data?.students ?? [];
  const count = (st: RsvpStatus) => students.filter((x) => x.status === st).length;
  // Who's coming first, then the ones still to chase, then the no's.
  const order: Record<RsvpStatus, number> = { accepted: 0, pending: 1, declined: 2 };
  const shown = students
    .filter((x) => filter === 'all' || x.status === filter)
    .sort((a, b) => order[a.status] - order[b.status] || (a.name ?? a.email).localeCompare(b.name ?? b.email));

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => router.back()} />
      </View>

      {loading ? (
        <View style={{ padding: 20, gap: 14 }}><Skeleton height={80} /><Skeleton height={64} /><Skeleton height={64} /></View>
      ) : error || !data ? (
        <EmptyState icon="alert-circle-outline" title="Couldn't load students" body={error ?? 'Try again in a moment.'} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        >
          <Animated.View entering={FadeInUp} style={{ gap: 6 }}>
            <Text variant="label" color={colors.primary}>{data.room.title}</Text>
            <Text variant="display">Students</Text>
            <Text color={colors.muted}>
              {count('accepted')} of {students.length} accepted the invite
            </Text>
          </Animated.View>

          <ChoiceRow<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: `All · ${students.length}` },
              { value: 'accepted', label: `Accepted · ${count('accepted')}` },
              { value: 'pending', label: `Pending · ${count('pending')}` },
              { value: 'declined', label: `Declined · ${count('declined')}` },
            ]}
          />

          {students.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="No students yet"
              body="Invite students by email, schedule this under a course, or share the join code / QR."
            />
          ) : shown.length === 0 ? (
            <View style={styles.none}>
              <Ionicons name={RSVP_STYLE[filter as RsvpStatus].icon} size={18} color={colors.muted} />
              <Text color={colors.muted}>No one is {RSVP_STYLE[filter as RsvpStatus].label.toLowerCase()} right now.</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {shown.map((st, i) => <StudentRow key={st.email} student={st} index={i} />)}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 8 },
  content: { padding: 20, gap: 20, paddingBottom: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: 12, ...shadow.card,
  },
  none: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 16, justifyContent: 'center' },
});
