import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExamCard } from '@/components/exam-card';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { examWindow, pendingGrades } from '@/lib/exam';
import type { Exam } from '@/lib/types';
import { useQuery } from '@/lib/use-query';
import { useSession } from '@/store/session';
import { colors, radius, shadow } from '@/theme';

function Section({ title, exams, render }: { title: string; exams: Exam[]; render: (exam: Exam, i: number) => React.ReactNode }) {
  if (!exams.length) return null;
  return (
    <View style={{ gap: 12 }}>
      <Text variant="label" color={colors.muted}>{title} · {exams.length}</Text>
      {exams.map(render)}
    </View>
  );
}

export default function Exams() {
  const me = useSession((s) => s.user)!;
  const teacher = me.role === 'teacher';
  // Exams on every course the user teaches or is enrolled in, each with the
  // student's own attempt or the teacher's submission count.
  const { data: allExams, loading, refreshing, refresh, error } = useQuery(() => api.listExams());
  const [now] = useState(() => Date.now());

  const groups = useMemo(() => {
    const mine = (allExams ?? []).filter((e) => !teacher || e.teacher.id === me.id);
    const byOpen = (a: Exam, b: Exam) => +new Date(a.opensAt) - +new Date(b.opensAt);
    const open = mine.filter((e) => examWindow(e, now) === 'open' && (teacher || !e.myAttempt)).sort(byOpen);
    const upcoming = mine.filter((e) => examWindow(e, now) === 'upcoming').sort(byOpen);
    const past = mine
      .filter((e) => !open.includes(e) && !upcoming.includes(e))
      .sort((a, b) => +new Date(b.closesAt) - +new Date(a.closesAt));
    return { open, upcoming, past, total: mine.length };
  }, [allExams, teacher, me.id, now]);

  const render = (exam: Exam, i: number) => (
    <ExamCard
      key={exam.id}
      exam={exam}
      index={i}
      showCourse
      onPress={() => router.push(`/exam/${exam.id}` as Href)}
      attempt={teacher ? undefined : exam.myAttempt ?? undefined}
      submissionCount={teacher ? exam.submissionCount ?? 0 : undefined}
      pending={teacher ? pendingGrades(exam) : undefined}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <Animated.View entering={FadeInUp.duration(400)} style={{ gap: 4 }}>
          <Text variant="title">Exams</Text>
          <Text color={colors.muted}>{teacher ? 'Build timed exams and follow the results' : 'Timed exams from your courses'}</Text>
        </Animated.View>

        {teacher && (
          <Animated.View entering={FadeInDown.delay(60)}>
            <PressableScale scaleTo={0.97} onPress={() => router.push('/exam/new' as Href)} style={styles.action}>
              <View style={styles.actionIcon}>
                <Ionicons name="add" size={24} color="#fff" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="heading" color="#fff">Create an exam</Text>
                <Text variant="small" color="rgba(255,255,255,0.6)">Questions, a time limit and an availability window</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
            </PressableScale>
          </Animated.View>
        )}

        {loading ? (
          <View style={{ gap: 14 }}>
            <Skeleton height={110} />
            <Skeleton height={110} />
          </View>
        ) : error ? (
          <EmptyState icon="cloud-offline-outline" title="Can't reach the server" body={error} />
        ) : groups.total === 0 ? (
          <EmptyState
            icon="ribbon-outline"
            title="No exams yet"
            body={teacher ? 'Create your first exam for one of your courses.' : 'When a teacher publishes an exam in one of your courses, it appears here.'}
          />
        ) : (
          <View style={{ gap: 24 }}>
            <Section title={teacher ? 'Open now' : 'Available'} exams={groups.open} render={render} />
            <Section title="Upcoming" exams={groups.upcoming} render={render} />
            <Section title={teacher ? 'Past' : 'Completed & past'} exams={groups.past} render={render} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 20, paddingBottom: 140 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: radius.xl, backgroundColor: colors.ink, ...shadow.float },
  actionIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.teacher },
});
