import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { ChoiceRow } from '@/components/ui/choice';
import { Input } from '@/components/ui/input';
import { Avatar, Chip, EmptyState, IconButton, Skeleton } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { openChatWith, startCall } from '@/lib/start-call';
import type { Student } from '@/lib/types';
import { useQuery } from '@/lib/use-query';
import { useIsTeacher } from '@/store/session';
import { colors, radius, shadow } from '@/theme';

/** 'all', 'pending' (no account yet), or a course id. */
type Filter = string;

function personOf(s: Student) {
  return { id: s.userId!, name: s.name ?? s.email, avatarUrl: s.avatarUrl ?? null };
}

function StudentRow({ student, index }: { student: Student; index: number }) {
  const joined = !!student.userId;
  const [first, ...more] = student.courses;
  const open = () => {
    if (joined) void openChatWith(personOf(student));
    else Alert.alert('Not signed up yet', `${student.email} was invited but hasn't created an account. They'll appear here once they do.`);
  };
  return (
    <Animated.View entering={FadeInDown.delay(40 + Math.min(index, 12) * 35)} layout={LinearTransition.springify()}>
      <PressableScale onPress={open} scaleTo={0.98} style={styles.row}>
        <Avatar name={student.name ?? student.email} size={44} uri={student.avatarUrl} ring={joined ? colors.student : undefined} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="bodyStrong" numberOfLines={1}>{student.name ?? student.email}</Text>
          <Text variant="small" color={colors.muted} numberOfLines={1}>
            {student.name ? student.email : 'Invited · no account yet'}
          </Text>
          <View style={styles.meta}>
            {first && <Chip label={first.title} icon="library" color={colors.teacher} bg={colors.teacherSoft} />}
            {more.length > 0 && <Chip label={`+${more.length}`} />}
            {student.sessionCount > 0 && (
              <Chip label={`${student.sessionCount} session${student.sessionCount > 1 ? 's' : ''}`} icon="calendar" />
            )}
          </View>
        </View>
        {joined ? (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <IconButton icon="call" size={38} bg={colors.successSoft} color={colors.success} onPress={() => void startCall(personOf(student))} />
            <IconButton icon="chatbubble" size={38} bg={colors.primarySoft} color={colors.primary} onPress={open} />
          </View>
        ) : (
          <Ionicons name="hourglass-outline" size={18} color={colors.muted} />
        )}
      </PressableScale>
    </Animated.View>
  );
}

/** A teacher's students, gathered across all their courses and sessions. */
export default function Students() {
  const teacher = useIsTeacher();
  const { data, loading, error, refreshing, refresh } = useQuery(() => api.listMyStudents());
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const students = useMemo(() => data ?? [], [data]);
  const courses = useMemo(() => {
    const seen = new Map<string, string>();
    students.forEach((s) => s.courses.forEach((c) => seen.set(c.id, c.title)));
    return [...seen].map(([id, title]) => ({ id, title }));
  }, [students]);
  const joined = students.filter((s) => s.userId).length;

  const q = search.trim().toLowerCase();
  const shown = students.filter((s) =>
    (filter === 'all' || (filter === 'pending' ? !s.userId : s.courses.some((c) => c.id === filter)))
    && (!q || (s.name ?? '').toLowerCase().includes(q) || s.email.includes(q)),
  );

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => router.back()} />
        {teacher && <IconButton icon="add" onPress={() => router.push('/course/new')} />}
      </View>

      {!teacher ? (
        <EmptyState icon="lock-closed-outline" title="Teachers only" body="The student list is part of the teacher's tools." />
      ) : loading ? (
        <View style={{ padding: 20, gap: 14 }}><Skeleton height={90} /><Skeleton height={76} /><Skeleton height={76} /><Skeleton height={76} /></View>
      ) : error ? (
        <EmptyState icon="cloud-offline-outline" title="Couldn't load your students" body={error} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        >
          <Animated.View entering={FadeInUp} style={{ gap: 6 }}>
            <Text variant="label" color={colors.primary}>Teaching</Text>
            <Text variant="display">Students</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(60)} style={styles.stats}>
            <View style={styles.stat}>
              <Text variant="title">{students.length}</Text>
              <Text variant="small" color={colors.muted}>Total</Text>
            </View>
            <View style={styles.stat}>
              <Text variant="title" color={colors.success}>{joined}</Text>
              <Text variant="small" color={colors.muted}>Signed up</Text>
            </View>
            <View style={styles.stat}>
              <Text variant="title">{courses.length}</Text>
              <Text variant="small" color={colors.muted}>Courses</Text>
            </View>
          </Animated.View>

          {students.length === 0 ? (
            <EmptyState
              icon="school-outline"
              title="No students yet"
              body="Create a course and invite students by email, or share its join code. They'll all show up here."
            >
              <Button title="Create a course" onPress={() => router.push('/course/new')} />
            </EmptyState>
          ) : (
            <>
              <Input icon="search" placeholder="Search by name or email" value={search} onChangeText={setSearch}
                autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
              <ChoiceRow<Filter>
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: `All · ${students.length}` },
                  ...courses.map((c) => ({ value: c.id, label: c.title })),
                  ...(students.length > joined ? [{ value: 'pending', label: `Not signed up · ${students.length - joined}` }] : []),
                ]}
              />
              {shown.length === 0 ? (
                <EmptyState icon="search-outline" title="No matches" body="Try another name, or clear the filter." />
              ) : (
                <View style={{ gap: 10 }}>
                  {shown.map((s, i) => <StudentRow key={s.email} student={s} index={i} />)}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  content: { padding: 20, gap: 18, paddingBottom: 60 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: colors.surface, borderRadius: radius.lg, ...shadow.card,
  },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
});
