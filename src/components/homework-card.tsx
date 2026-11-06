import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { formatDay } from '@/lib/format';
import type { Homework } from '@/lib/types';
import { colors, radius, shadow } from '@/theme';
import { Chip } from './ui/misc';
import { PressableScale } from './ui/pressable-scale';
import { Text } from './ui/text';

type Status = 'submitted' | 'overdue' | 'due';

const STATUS_STYLE: Record<Status, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  submitted: { label: 'Submitted', color: colors.success, bg: colors.successSoft, icon: 'checkmark-circle' },
  overdue: { label: 'Overdue', color: colors.danger, bg: colors.dangerSoft, icon: 'alert-circle' },
  due: { label: 'Pending', color: colors.primary, bg: colors.primarySoft, icon: 'time-outline' },
};

export function HomeworkCard({ homework, index, submissionCount, submitted, onPress }: {
  homework: Homework;
  index: number;
  onPress: () => void;
  /** Teacher view: how many students have submitted. */
  submissionCount?: number;
  /** Student view: whether they've already submitted. */
  submitted?: boolean;
}) {
  const [overdue] = useState(() => new Date(homework.dueAt).getTime() < Date.now());
  const status = submitted !== undefined
    ? STATUS_STYLE[submitted ? 'submitted' : overdue ? 'overdue' : 'due']
    : null;
  return (
    <Animated.View entering={FadeInDown.delay(60 + index * 50)} layout={LinearTransition.springify()}>
      <PressableScale onPress={onPress} scaleTo={0.97} style={styles.card}>
        <View style={styles.icon}>
          <Ionicons name="document-text-outline" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="bodyStrong" numberOfLines={1}>{homework.title}</Text>
          <View style={styles.meta}>
            <Text variant="small" color={colors.muted}>Due {formatDay(homework.dueAt)}</Text>
            {status && <Chip label={status.label} icon={status.icon} color={status.color} bg={status.bg} />}
            {submissionCount !== undefined && <Chip label={`${submissionCount} submitted`} icon="people-outline" />}
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
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
});
