import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/screen';
import { ActionCard, ExamCard } from '@/components/cards';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { examWindow, pendingGrades } from '@/lib/exam';
import type { Exam } from '@/lib/types';
import { useQuery } from '@/lib/use-query';
import { useMe } from '@/store/session';
import { colors } from '@/theme';
import { TabPage } from './tab-page';

function Section({ title, exams, render }: { title: string; exams: Exam[]; render: (exam: Exam, i: number) => ReactNode }) {
  if (!exams.length) return null;
  return (
    <div className="v" style={{ gap: 12 }}>
      <Text variant="label" color={colors.muted}>{title} · {exams.length}</Text>
      <div className="cards-grid" style={{ gap: 12 }}>{exams.map(render)}</div>
    </div>
  );
}

export default function Exams() {
  const me = useMe();
  const teacher = me.role === 'teacher';
  const navigate = useNavigate();
  // Exams on every course the user teaches or is enrolled in, each with the
  // student's own attempt or the teacher's submission count.
  const { data: allExams, loading, error, refresh, refreshing } = useQuery(() => api.listExams());
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
      onPress={() => navigate(`/exam/${exam.id}`)}
      attempt={teacher ? undefined : exam.myAttempt ?? undefined}
      submissionCount={teacher ? exam.submissionCount ?? 0 : undefined}
      pending={teacher ? pendingGrades(exam) : undefined}
    />
  );

  return (
    <TabPage onRefresh={refresh} refreshing={refreshing}>
      <PageHeader
        title="Exams"
        subtitle={teacher ? 'Build timed exams and follow the results' : 'Timed exams from your courses'}
        actions={teacher && <Button size="md" icon="add" title="Create an exam" onPress={() => navigate('/exam/new')} />}
      />

      {teacher && (
        <div className="mobile-only">
        <ActionCard
          tone={colors.teacher}
          icon="add"
          title="Create an exam"
          body="Questions, a time limit and an availability window"
          onPress={() => navigate('/exam/new')}
        />
        </div>
      )}

      {loading ? (
        <div className="cards-grid">
          <Skeleton height={110} />
          <Skeleton height={110} />
          <Skeleton height={110} />
        </div>
      ) : error ? (
        <EmptyState icon="cloud-offline-outline" title="Can't reach the server" body={error} />
      ) : groups.total === 0 ? (
        <EmptyState
          icon="ribbon-outline"
          title="No exams yet"
          body={teacher ? 'Create your first exam for one of your courses.' : 'When a teacher publishes an exam in one of your courses, it appears here.'}
        />
      ) : (
        <div className="v" style={{ gap: 24 }}>
          <Section title={teacher ? 'Open now' : 'Available'} exams={groups.open} render={render} />
          <Section title="Upcoming" exams={groups.upcoming} render={render} />
          <Section title={teacher ? 'Past' : 'Completed & past'} exams={groups.past} render={render} />
        </div>
      )}
    </TabPage>
  );
}
