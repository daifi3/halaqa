import { useState } from 'react';
import { examWindow, formatGrade, scoreAttempt } from '@/lib/exam';
import { formatBytes, formatDay, formatTime } from '@/lib/format';
import type { Course, Exam, ExamAttempt, Homework, Room, VaultDocument } from '@/lib/types';
import { colors, radius } from '@/theme';
import { Icon, type IconName } from './ui/icon';
import { Chip, delay, PersonAvatar, PulseDot } from './ui/misc';
import { Pressable } from './ui/pressable';
import { Text } from './ui/text';

const card: React.CSSProperties = {
  backgroundColor: colors.surface, borderRadius: radius.xl, padding: 20, display: 'flex', flexDirection: 'column',
  gap: 16, boxShadow: 'var(--shadow-card)', width: '100%',
};

const row: React.CSSProperties = {
  display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface,
  borderRadius: radius.lg, padding: 14, boxShadow: 'var(--shadow-card)', width: '100%',
};

function RowIcon({ name }: { name: IconName }) {
  return (
    <span className="h center" style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, flexShrink: 0 }}>
      <Icon name={name} size={20} color={colors.primary} />
    </span>
  );
}

/* ---------- Room ---------- */

export function RoomCard({ room, index, onPress }: { room: Room; index: number; onPress: () => void }) {
  const live = room.status === 'live';
  return (
    <div className="a-down" style={delay(80 + index * 70)}>
      <Pressable onClick={onPress} scaleTo={0.97} style={{ ...card, ...(live ? { backgroundColor: colors.primary } : null) }}>
        <div className="h" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="v" style={{ backgroundColor: live ? 'rgba(255,255,255,0.12)' : colors.bg, borderRadius: radius.md, padding: '8px 12px' }}>
            <Text variant="small" color={live ? '#fff' : colors.muted}>{formatDay(room.startsAt)}</Text>
            <Text variant="heading" color={live ? '#fff' : colors.ink}>{formatTime(room.startsAt)}</Text>
          </div>
          {live ? (
            <span className="h" style={{ gap: 8, backgroundColor: 'rgba(0,0,0,0.22)', padding: '6px 12px', borderRadius: radius.pill }}>
              <PulseDot color="#FF6B6B" size={7} />
              <Text variant="label" color="#fff">Live now</Text>
            </span>
          ) : (
            <Chip label={`${room.durationMin} min`} icon="time-outline" />
          )}
        </div>

        <div className="v" style={{ gap: 4 }}>
          <Text variant="label" color={live ? 'rgba(255,255,255,0.65)' : colors.primary}>{room.subject}</Text>
          <Text variant="title" color={live ? '#fff' : colors.ink} lines={2}>{room.title}</Text>
        </div>

        <div className="h" style={{ justifyContent: 'space-between' }}>
          <div className="h" style={{ gap: 8 }}>
            <PersonAvatar person={room.teacher} size={28} />
            <Text variant="small" color={live ? 'rgba(255,255,255,0.8)' : colors.inkSoft}>{room.teacher.name}</Text>
          </div>
          <span className="h center" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: live ? '#fff' : colors.ink }}>
            <Icon name="arrow-forward" size={18} color={live ? colors.ink : '#fff'} />
          </span>
        </div>
      </Pressable>
    </div>
  );
}

/* ---------- Course ---------- */

export function CourseCard({ course, index, onPress }: { course: Course; index: number; onPress: () => void }) {
  return (
    <div className="a-down" style={delay(80 + index * 70)}>
      <Pressable onClick={onPress} scaleTo={0.97} style={{ ...card, gap: 12 }}>
        <div className="h" style={{ justifyContent: 'space-between' }}>
          <Text variant="label" color={colors.primary}>{course.subject}</Text>
          <Chip label={`${course.roomCount} session${course.roomCount === 1 ? '' : 's'}`} icon="videocam-outline" />
        </div>
        <Text variant="title" lines={2}>{course.title}</Text>
        {!!course.description && <Text color={colors.muted} lines={2}>{course.description}</Text>}
        <div className="h" style={{ justifyContent: 'space-between', marginTop: 4 }}>
          <div className="h" style={{ gap: 8 }}>
            <PersonAvatar person={course.teacher} size={28} />
            <Text variant="small" color={colors.inkSoft}>{course.teacher.name}</Text>
          </div>
          <div className="h" style={{ gap: 5 }}>
            <Icon name="people-outline" size={14} color={colors.muted} />
            <Text variant="small" color={colors.muted}>{course.memberCount + course.invitedEmails.length} enrolled</Text>
          </div>
        </div>
      </Pressable>
    </div>
  );
}

/* ---------- Exam ---------- */

type Badge = { label: string; color: string; bg: string; icon: IconName };

function badgeFor(exam: Exam, now: number, attempt: ExamAttempt | undefined, teacher: boolean): Badge {
  const window = examWindow(exam, now);
  if (!teacher && attempt) {
    if (!exam.showResults && !attempt.finalizedAt) return { label: 'Awaiting grade', color: colors.success, bg: colors.successSoft, icon: 'checkmark-circle' };
    const { grade, scale, ungraded } = scoreAttempt(exam, attempt);
    if (attempt.finalizedAt) return { label: `${formatGrade(grade)}/${scale} · final`, color: colors.success, bg: colors.successSoft, icon: 'ribbon' };
    return {
      label: ungraded ? 'Grading in progress' : `${formatGrade(grade)}/${scale} · not final`,
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

export function ExamCard({ exam, index, onPress, attempt, submissionCount, pending, showCourse }: {
  exam: Exam;
  index: number;
  onPress: () => void;
  /** Student view: their attempt, if any. */
  attempt?: ExamAttempt;
  /** Teacher view: how many students have finished. */
  submissionCount?: number;
  /** Teacher view: finished attempts whose grade isn't final yet. */
  pending?: number | null;
  showCourse?: boolean;
}) {
  const [now] = useState(() => Date.now());
  const teacher = submissionCount !== undefined;
  const badge = badgeFor(exam, now, attempt, teacher);
  const window = examWindow(exam, now);

  return (
    <div className="a-down" style={delay(60 + index * 50)}>
      <Pressable onClick={onPress} scaleTo={0.97} style={row}>
        <RowIcon name="ribbon-outline" />
        <div className="v flex1" style={{ gap: 4 }}>
          {showCourse && <Text variant="small" color={colors.primary} lines={1}>{exam.courseTitle}</Text>}
          <Text variant="bodyStrong" lines={1}>{exam.title}</Text>
          <Text variant="small" color={colors.muted}>
            {exam.questionCount} {exam.questionCount === 1 ? 'question' : 'questions'} · {exam.durationMin} min
            {window === 'open' && !attempt ? ` · until ${formatDay(exam.closesAt)} ${formatTime(exam.closesAt)}` : ''}
          </Text>
          <div className="h wrap" style={{ gap: 6, marginTop: 2 }}>
            <Chip label={badge.label} icon={badge.icon} color={badge.color} bg={badge.bg} />
            {teacher && <Chip label={`${submissionCount} submitted`} icon="people-outline" />}
            {teacher && !!pending && <Chip label={`${pending} to grade`} icon="create-outline" color={colors.student} bg={colors.studentSoft} />}
          </div>
        </div>
        <Icon name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
    </div>
  );
}

/* ---------- Homework ---------- */

type Status = 'submitted' | 'overdue' | 'due';

const STATUS_STYLE: Record<Status, { label: string; color: string; bg: string; icon: IconName }> = {
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
  const status = submitted !== undefined ? STATUS_STYLE[submitted ? 'submitted' : overdue ? 'overdue' : 'due'] : null;
  return (
    <div className="a-down" style={delay(60 + index * 50)}>
      <Pressable onClick={onPress} scaleTo={0.97} style={row}>
        <RowIcon name="document-text-outline" />
        <div className="v flex1" style={{ gap: 4 }}>
          <Text variant="bodyStrong" lines={1}>{homework.title}</Text>
          <div className="h wrap" style={{ gap: 6 }}>
            <Text variant="small" color={colors.muted}>Due {formatDay(homework.dueAt)}</Text>
            {status && <Chip label={status.label} icon={status.icon} color={status.color} bg={status.bg} />}
            {submissionCount !== undefined && <Chip label={`${submissionCount} submitted`} icon="people-outline" />}
          </div>
        </div>
        <Icon name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
    </div>
  );
}

/* ---------- Vault document ---------- */

export function iconForMime(mime: string | null): IconName {
  if (!mime) return 'document-outline';
  if (mime.startsWith('image/')) return 'image-outline';
  if (mime.startsWith('video/')) return 'videocam-outline';
  if (mime.startsWith('audio/')) return 'musical-notes-outline';
  if (mime === 'application/pdf') return 'document-text-outline';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'grid-outline';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'easel-outline';
  return 'document-outline';
}

export function VaultDocumentCard({ document, index, onPress }: { document: VaultDocument; index: number; onPress: () => void }) {
  return (
    <div className="a-down" style={delay(60 + index * 50)}>
      <Pressable onClick={onPress} scaleTo={0.97} style={row}>
        <RowIcon name={iconForMime(document.mimeType)} />
        <div className="v flex1" style={{ gap: 4 }}>
          <Text variant="bodyStrong" lines={1}>{document.title}</Text>
          <div className="h wrap" style={{ gap: 6 }}>
            <Text variant="small" color={colors.muted}>{formatBytes(document.sizeBytes)} · {formatDay(document.createdAt)}</Text>
            {document.folder && <Chip label={document.folder} icon="folder-outline" />}
            {document.canManage && document.sharedEmails.length > 0 && (
              <Chip label={`Shared · ${document.sharedEmails.length}`} icon="people-outline" color={colors.primary} bg={colors.primarySoft} />
            )}
          </div>
        </div>
        <Icon name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
    </div>
  );
}

/* ---------- Dark "action" card at the top of the tabs ---------- */

export function ActionCard({ tone, icon, title, body, onPress, delayMs = 60 }: {
  tone: string; icon: IconName; title: string; body: string; onPress: () => void; delayMs?: number;
}) {
  return (
    <div className="a-down" style={delay(delayMs)}>
      <Pressable
        onClick={onPress}
        scaleTo={0.97}
        style={{ ...row, gap: 14, padding: 18, borderRadius: radius.xl, backgroundColor: colors.ink, boxShadow: 'var(--shadow-float)' }}
      >
        <span className="h center" style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: tone, flexShrink: 0 }}>
          <Icon name={icon} size={24} color="#fff" />
        </span>
        <div className="v flex1" style={{ gap: 2 }}>
          <Text variant="heading" color="#fff">{title}</Text>
          <Text variant="small" color="rgba(255,255,255,0.6)">{body}</Text>
        </div>
        <Icon name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
      </Pressable>
    </div>
  );
}
