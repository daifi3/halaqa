import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import type { Course } from '@/lib/types';
import { colors, radius, shadow } from '@/theme';
import { Chip, PersonAvatar } from './ui/misc';
import { PressableScale } from './ui/pressable-scale';
import { Text } from './ui/text';

export function CourseCard({ course, index, onPress }: { course: Course; index: number; onPress: () => void }) {
  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 70)} layout={LinearTransition.springify()}>
      <PressableScale onPress={onPress} scaleTo={0.97} style={styles.card}>
        <View style={styles.top}>
          <Text variant="label" color={colors.primary}>{course.subject}</Text>
          <Chip label={`${course.roomCount} session${course.roomCount === 1 ? '' : 's'}`} icon="videocam-outline" />
        </View>

        <Text variant="title" numberOfLines={2}>{course.title}</Text>
        {!!course.description && (
          <Text color={colors.muted} numberOfLines={2}>{course.description}</Text>
        )}

        <View style={styles.bottom}>
          <View style={styles.teacher}>
            <PersonAvatar person={course.teacher} size={28} />
            <Text variant="small" color={colors.inkSoft}>{course.teacher.name}</Text>
          </View>
          <View style={styles.roster}>
            <Ionicons name="people-outline" size={14} color={colors.muted} />
            <Text variant="small" color={colors.muted}>
              {course.memberCount + course.invitedEmails.length} enrolled
            </Text>
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 20, gap: 12, ...shadow.card },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  teacher: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roster: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
