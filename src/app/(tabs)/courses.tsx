import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CourseCard } from '@/components/course-card';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/use-query';
import { useSession } from '@/store/session';
import { colors, radius, shadow } from '@/theme';

function ActionCard({ teacher }: { teacher: boolean }) {
  const tone = teacher ? colors.teacher : colors.student;
  return (
    <Animated.View entering={FadeInDown.delay(60)}>
      <PressableScale
        scaleTo={0.97}
        onPress={() => router.push(teacher ? '/course/new' : '/course/join')}
        style={[styles.action, { backgroundColor: colors.ink }]}
      >
        <View style={[styles.actionIcon, { backgroundColor: tone }]}>
          <Ionicons name={teacher ? 'add' : 'keypad'} size={24} color="#fff" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading" color="#fff">{teacher ? 'Create a course' : 'Join a course'}</Text>
          <Text variant="small" color="rgba(255,255,255,0.6)">
            {teacher ? 'Set up a roster, then schedule sessions under it' : "Enter the 6-letter code your teacher shared"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
      </PressableScale>
    </Animated.View>
  );
}

export default function Courses() {
  const teacher = useSession((s) => s.user?.role === 'teacher');
  const { data: courses, loading, refreshing, refresh, error } = useQuery(() => api.listCourses());

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <Animated.View entering={FadeInUp.duration(400)} style={{ gap: 4 }}>
          <Text variant="title">Courses</Text>
          <Text color={colors.muted}>{teacher ? 'Your standing classes and their rosters' : "Courses you're enrolled in"}</Text>
        </Animated.View>

        <ActionCard teacher={teacher} />

        {loading ? (
          <View style={{ gap: 14 }}>
            <Skeleton height={150} />
            <Skeleton height={150} />
          </View>
        ) : error ? (
          <EmptyState icon="cloud-offline-outline" title="Can't reach the server" body={error} />
        ) : !courses || courses.length === 0 ? (
          <EmptyState
            icon={teacher ? 'library-outline' : 'school-outline'}
            title="No courses yet"
            body={teacher ? 'Create your first course to build a standing roster.' : 'When a teacher invites you to a course, it appears here.'}
          />
        ) : (
          <View style={{ gap: 14 }}>
            <Text variant="label" color={colors.muted}>{teacher ? 'Your courses' : 'Enrolled'} · {courses.length}</Text>
            {courses.map((course, i) => (
              <CourseCard key={course.id} course={course} index={i} onPress={() => router.push(`/course/${course.id}`)} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 20, paddingBottom: 140 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: radius.xl, ...shadow.float },
  actionIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
