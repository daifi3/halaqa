import { useState } from 'react';
import { useParams } from 'react-router';
import { ChoiceRow } from '@/components/ui/choice';
import { Icon } from '@/components/ui/icon';
import { Avatar, Chip, delay, EmptyState, Skeleton } from '@/components/ui/misc';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { RSVP_STYLE } from '@/lib/links';
import type { RoomStudent, RsvpStatus } from '@/lib/types';
import { useQuery } from '@/lib/use-query';
import { colors, radius } from '@/theme';

type Filter = 'all' | RsvpStatus;

const SOURCE_LABEL: Record<RoomStudent['source'], string> = {
  invite: 'Invited',
  course: 'Course roster',
  code: 'Joined with code',
};

function StudentRow({ student, index }: { student: RoomStudent; index: number }) {
  const s = RSVP_STYLE[student.status];
  return (
    <div className="h a-down" style={{ ...delay(60 + index * 40), gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, boxShadow: 'var(--shadow-card)' }}>
      <Avatar name={student.name ?? student.email} size={40} uri={student.avatarUrl} />
      <div className="v flex1" style={{ gap: 2 }}>
        <Text variant="bodyStrong" lines={1}>{student.name ?? student.email}</Text>
        <Text variant="small" color={colors.muted} lines={1}>
          {student.name ? student.email : 'No account yet'} · {SOURCE_LABEL[student.source]}
        </Text>
      </div>
      <Chip label={s.label} icon={s.icon} color={s.fg} bg={s.bg} />
    </div>
  );
}

export default function RoomStudents() {
  const { id = '' } = useParams();
  const { data, loading, error } = useQuery(
    () => Promise.all([api.getRoom(id), api.listRoomStudents(id)]).then(([room, students]) => ({ room, students })),
    [id],
  );
  const [filter, setFilter] = useState<Filter>('all');

  const students = data?.students ?? [];
  const count = (st: RsvpStatus) => students.filter((x) => x.status === st).length;
  // Who's coming first, then the ones still to chase, then the no's.
  const order: Record<RsvpStatus, number> = { accepted: 0, pending: 1, declined: 2 };
  const shown = students
    .filter((x) => filter === 'all' || x.status === filter)
    .sort((a, b) => order[a.status] - order[b.status] || (a.name ?? a.email).localeCompare(b.name ?? b.email));

  return (
    <Screen style={{ gap: 20 }}>
      {loading ? (
        <div className="v" style={{ gap: 14 }}><Skeleton height={80} /><Skeleton height={64} /><Skeleton height={64} /></div>
      ) : error || !data ? (
        <EmptyState icon="alert-circle-outline" title="Couldn't load students" body={error ?? 'Try again in a moment.'} />
      ) : (
        <>
          <div className="v a-up" style={{ gap: 6 }}>
            <Text variant="label" color={colors.primary}>{data.room.title}</Text>
            <Text variant="display">Students</Text>
            <Text color={colors.muted}>{count('accepted')} of {students.length} accepted the invite</Text>
          </div>

          <ChoiceRow<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: `All · ${students.length}` },
              { value: 'accepted', label: `Accepted · ${count('accepted')}` },
              { value: 'pending', label: `Pending · ${count('pending')}` },
              { value: 'declined', label: `Declined · ${count('declined')}` },
            ]}
          />

          {students.length === 0 ? (
            <EmptyState icon="people-outline" title="No students yet" body="Invite students by email, schedule this under a course, or share the join code / QR." />
          ) : shown.length === 0 ? (
            <div className="h" style={{ gap: 8, padding: '16px 0', justifyContent: 'center' }}>
              <Icon name={RSVP_STYLE[filter as RsvpStatus].icon} size={18} color={colors.muted} />
              <Text color={colors.muted}>No one is {RSVP_STYLE[filter as RsvpStatus].label.toLowerCase()} right now.</Text>
            </div>
          ) : (
            <div className="cards-grid dense" style={{ gap: 8, paddingBottom: 40 }}>
              {shown.map((st, i) => <StudentRow key={st.email} student={st} index={i} />)}
            </div>
          )}
        </>
      )}
    </Screen>
  );
}
