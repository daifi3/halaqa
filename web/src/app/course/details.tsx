import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ExamCard, HomeworkCard, RoomCard } from '@/components/cards';
import { CodeCard } from '@/components/code-card';
import { EmailAdder, EmailRow } from '@/components/email-list';
import { JoinQrPanel } from '@/components/qr-code';
import { Icon } from '@/components/ui/icon';
import { delay, EmptyState, IconButton, PersonAvatar, Skeleton } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { pendingGrades } from '@/lib/exam';
import { isValidEmail } from '@/lib/format';
import { shareText } from '@/lib/links';
import { useQuery } from '@/lib/use-query';
import { useMe } from '@/store/session';
import { colors, radius } from '@/theme';

function Group({ title, action, onAction, delayMs, children }: {
  title: string; action?: string; onAction?: () => void; delayMs: number; children: ReactNode;
}) {
  return (
    <div className="v a-down" style={{ ...delay(delayMs), gap: 14 }}>
      <div className="h" style={{ justifyContent: 'space-between' }}>
        <Text variant="label" color={colors.muted}>{title}</Text>
        {action && (
          <Pressable onClick={onAction} style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: colors.primarySoft, padding: '6px 12px', borderRadius: radius.pill }}>
            <Icon name="add" size={16} color={colors.primary} />
            <Text variant="small" color={colors.primary}>{action}</Text>
          </Pressable>
        )}
      </div>
      {children}
    </div>
  );
}

export default function CourseDetails() {
  const { id = '' } = useParams();
  const me = useMe();
  const navigate = useNavigate();
  const { data, loading, error, setData } = useQuery(() =>
    Promise.all([api.getCourse(id), api.listCourseRooms(id), api.listCourseHomework(id), api.listCourseExams(id)])
      .then(([course, rooms, homework, exams]) => ({ course, rooms, homework, exams })), [id]);
  // Only the course's own teacher manages it — other teachers see it as a guest.
  const teacher = data?.course.teacher.id === me.id;
  const homework = data?.homework ?? [];
  const exams = data?.exams ?? [];
  const [showQr, setShowQr] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [shared, setShared] = useState(false);

  async function invite() {
    if (inviting) return;
    const e = emailDraft.trim().toLowerCase();
    if (!isValidEmail(e)) return setInviteError('That email looks off');
    setInviting(true);
    try {
      const course = await api.inviteToCourse(id, [e]);
      setData((d) => d && { ...d, course });
      setEmailDraft('');
      setInviteError(null);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Could not invite');
    } finally {
      setInviting(false);
    }
  }

  const course = data?.course;
  const rooms = data?.rooms ?? [];

  const shareButton = course && (
    <IconButton
      icon={shared ? 'checkmark' : 'share-outline'}
      label="Share invite"
      onPress={async () => {
        if ((await shareText(`Join my course "${course.title}" on Halaqa. Code: ${course.joinCode}`)) === 'copied') setShared(true);
      }}
    />
  );

  return (
    <Screen right={shareButton} style={{ gap: 24, paddingBottom: 40 }}>
      {loading ? (
        <div className="v" style={{ gap: 14 }}><Skeleton height={140} /><Skeleton height={90} /></div>
      ) : error || !course ? (
        <EmptyState icon="alert-circle-outline" title="Course unavailable" body={error ?? 'This course no longer exists.'} />
      ) : (
        /* Only the teacher has a side panel (code, QR, roster). */
        <div className={teacher ? 'split' : 'split-main'}>
          <div className="split-main">
          <div className="v a-up" style={{ gap: 8 }}>
            <Text variant="label" color={colors.primary}>{course.subject}</Text>
            <Text variant="display">{course.title}</Text>
            {!!course.description && <Text color={colors.inkSoft}>{course.description}</Text>}
            <div className="h" style={{ gap: 10, marginTop: 4 }}>
              <PersonAvatar person={course.teacher} size={32} />
              <Text color={colors.inkSoft}>with {course.teacher.name}</Text>
            </div>
          </div>

          </div>

          {teacher && (
          <div className="split-side">
          {teacher && <CodeCard code={course.joinCode} showQr={showQr} onToggleQr={() => setShowQr((v) => !v)} delayMs={100} />}
          {teacher && showQr && <JoinQrPanel kind="course" code={course.joinCode} title={course.title} />}

          {teacher && (
            <div className="v a-down" style={{ ...delay(160), gap: 10 }}>
              <Text variant="label" color={colors.muted}>Roster · {course.invitedEmails.length}</Text>
              <EmailAdder
                value={emailDraft}
                onChange={(t) => { setEmailDraft(t); setInviteError(null); }}
                onAdd={invite}
                placeholder="Invite another student by email"
                error={inviteError}
              />
              <div className="v" style={{ gap: 8 }}>
                {course.invitedEmails.map((e) => (
                  <EmailRow key={e} email={e} trailing={<Icon name="mail-outline" size={16} color={colors.muted} />} />
                ))}
              </div>
            </div>
          )}

          </div>
          )}

          <div className="split-main">
          <Group title={`Sessions · ${rooms.length}`} action={teacher ? 'Schedule' : undefined} onAction={() => navigate(`/room/new?courseId=${course.id}`)} delayMs={220}>
            {rooms.length === 0 ? (
              <Text color={colors.muted}>No sessions scheduled yet.</Text>
            ) : (
              <div className="cards-grid">
                {rooms.map((room, i) => <RoomCard key={room.id} room={room} index={i} onPress={() => navigate(`/room/${room.id}`)} />)}
              </div>
            )}
          </Group>

          <Group title={`Homework · ${homework.length}`} action={teacher ? 'Assign' : undefined} onAction={() => navigate(`/homework/new?courseId=${course.id}`)} delayMs={280}>
            {homework.length === 0 ? (
              <Text color={colors.muted}>No homework assigned yet.</Text>
            ) : (
              <div className="cards-grid">{homework.map((hw, i) => (
                <HomeworkCard
                  key={hw.id}
                  homework={hw}
                  index={i}
                  onPress={() => navigate(`/homework/${hw.id}`)}
                  submissionCount={teacher ? hw.submissionCount ?? 0 : undefined}
                  submitted={teacher ? undefined : !!hw.mySubmittedAt}
                />
              ))}</div>
            )}
          </Group>

          <Group title={`Exams · ${exams.length}`} action={teacher ? 'Create' : undefined} onAction={() => navigate(`/exam/new?courseId=${course.id}`)} delayMs={340}>
            {exams.length === 0 ? (
              <Text color={colors.muted}>No exams yet.</Text>
            ) : (
              <div className="cards-grid">{exams.map((exam, i) => (
                <ExamCard
                  key={exam.id}
                  exam={exam}
                  index={i}
                  onPress={() => navigate(`/exam/${exam.id}`)}
                  attempt={teacher ? undefined : exam.myAttempt ?? undefined}
                  submissionCount={teacher ? exam.submissionCount ?? 0 : undefined}
                  pending={teacher ? pendingGrades(exam) : undefined}
                />
              ))}</div>
            )}
          </Group>
          </div>
        </div>
      )}
    </Screen>
  );
}
