import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { examWindow, formatGrade, scoreAttempt } from '@/lib/exam';
import { formatDay, formatTime } from '@/lib/format';
import type { Exam, ExamAttempt } from '@/lib/types';
import { colors, radius, shadow } from '@/theme';
import { Chip } from './ui/misc';
import { PressableScale } from './ui/pressable-scale';
import { Text } from './ui/text';

type Badge = { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap };

function badgeFor(exam: Exam, now: number, attempt: ExamAttempt | undefined, teacher: boolean): Badge {
  const window = examWindow(exam, now);
  if (!teacher && attempt) {
    if (!exam.showResults) return { label: 'Completed', color: colors.success, bg: colors.successSoft, icon: 'checkmark-circle' };
    const { grade, scale, ungraded } = scoreAttempt(exam, attempt);
    return {
      label: ungraded ? `Grading in progress` : `${formatGrade(grade)}/${scale}`,
      color: colors.success, bg: colors.successSoft, icon: 'checkmark-circle',
    };
  }
  if (window === 'upcoming') return { label: `Opens ${formatDay(exam.opensAt)}`, color: colors.inkSoft, bg: colors.surfaceAlt, icon: 'calendar-outline' };
  if (window === 'closed') {
    return teacher
      ? { label: 'Closed', color: colors.inkSoft, bg: colors.surfaceAlt, icon: 'lock-closed-outline' }
      : { label: 'Missed', color: colors.danger, bg: colors.dangerSoft, icon: 'alert-circle' };
  }
  return { label: 'Open now', color: colors.primary, bg: colors.primarySoft, icon: 'radio-button-on' };
}

export function ExamCard({ exam, index, onPress, attempt, submissionCount, showCourse }: {
  exam: Exam;
  index: number;
  onPress: () => void;
  /** Student view: their attempt, if any. */
  attempt?: ExamAttempt;
  /** Teacher view: how many students have finished. */
  submissionCount?: number;
  showCourse?: boolean;
}) {
  const [now] = useState(() => Date.now());
  const teacher = submissionCount !== undefined;
  const badge = badgeFor(exam, now, attempt, teacher);
  const window = examWindow(exam, now);

  return (
    <Animated.View entering={FadeInDown.delay(60 + index * 50)} layout={LinearTransition.springify()}>
      <PressableScale onPress={onPress} scaleTo={0.97} style={styles.card}>
        <View style={styles.icon}>
          <Ionicons name="ribbon-outline" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          {showCourse && <Text variant="small" color={colors.primary} numberOfLines={1}>{exam.courseTitle}</Text>}
          <Text variant="bodyStrong" numberOfLines={1}>{exam.title}</Text>
          <Text variant="small" color={colors.muted}>
            {exam.questionCount} {exam.questionCount === 1 ? 'question' : 'questions'} · {exam.durationMin} min
            {window === 'open' && !attempt ? ` · until ${formatDay(exam.closesAt)} ${formatTime(exam.closesAt)}` : ''}
          </Text>
          <View style={styles.meta}>
            <Chip label={badge.label} icon={badge.icon} color={badge.color} bg={badge.bg} />
            {teacher && <Chip label={`${submissionCount} submitted`} icon="people-outline" />}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: 14, ...shadow.card,
  },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 },
});
