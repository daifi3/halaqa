import { useNavigate } from 'react-router';
import { ActionCard, CourseCard } from '@/components/cards';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/screen';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/use-query';
import { useIsTeacher } from '@/store/session';
import { colors } from '@/theme';
import { TabPage } from './tab-page';

export default function Courses() {
  const teacher = useIsTeacher();
  const navigate = useNavigate();
  const { data: courses, loading, error, refresh, refreshing } = useQuery(() => api.listCourses());

  return (
    <TabPage onRefresh={refresh} refreshing={refreshing}>
      <PageHeader
        title="Courses"
        subtitle={teacher ? 'Your standing classes and their rosters' : "Courses you're enrolled in"}
        actions={
          <Button size="md" icon={teacher ? 'add' : 'keypad'} title={teacher ? 'Create a course' : 'Join a course'}
            onPress={() => navigate(teacher ? '/course/new' : '/course/join')} />
        }
      />

      <div className="mobile-only">
      <ActionCard
        tone={teacher ? colors.teacher : colors.student}
        icon={teacher ? 'add' : 'keypad'}
        title={teacher ? 'Create a course' : 'Join a course'}
        body={teacher ? 'Set up a roster, then schedule sessions under it' : 'Enter the 6-letter code your teacher shared'}
        onPress={() => navigate(teacher ? '/course/new' : '/course/join')}
      />
      </div>

      {loading ? (
        <div className="cards-grid">
          <Skeleton height={150} />
          <Skeleton height={150} />
          <Skeleton height={150} />
        </div>
      ) : error ? (
        <EmptyState icon="cloud-offline-outline" title="Can't reach the server" body={error} />
      ) : !courses || courses.length === 0 ? (
        <EmptyState
          icon={teacher ? 'library-outline' : 'school-outline'}
          title="No courses yet"
          body={teacher ? 'Create your first course to build a standing roster.' : 'When a teacher invites you to a course, it appears here.'}
        />
      ) : (
        <div className="v" style={{ gap: 14 }}>
          <Text variant="label" color={colors.muted}>{teacher ? 'Your courses' : 'Enrolled'} · {courses.length}</Text>
          <div className="cards-grid">
            {courses.map((course, i) => (
              <CourseCard key={course.id} course={course} index={i} onPress={() => navigate(`/course/${course.id}`)} />
            ))}
          </div>
        </div>
      )}
    </TabPage>
  );
}
