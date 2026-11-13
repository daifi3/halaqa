import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { CodeCard } from '@/components/code-card';
import { JoinQrPanel } from '@/components/qr-code';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { delay, EmptyState, IconButton, PersonAvatar, PulseDot, Skeleton } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { formatDay, formatTime } from '@/lib/format';
import { RSVP_STYLE, shareText } from '@/lib/links';
import type { RoomStudent, RsvpStatus } from '@/lib/types';
import { useQuery } from '@/lib/use-query';
import { useIsTeacher, useSession } from '@/store/session';
import { colors, radius } from '@/theme';

function InfoTile({ icon, label, value, delayMs }: { icon: IconName; label: string; value: string; delayMs: number }) {
  return (
    <div className="v flex1 a-down" style={{ ...delay(delayMs), backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 4, boxShadow: 'var(--shadow-card)' }}>
      <Icon name={icon} size={18} color={colors.primary} />
      <Text variant="small" color={colors.muted}>{label}</Text>
      <Text variant="bodyStrong">{value}</Text>
    </div>
  );
}

/** Student-facing: answer the invite. Either choice can be changed until the class ends. */
function RsvpCard({ status, busy, onAnswer }: {
  status: RsvpStatus; busy: boolean; onAnswer: (r: Exclude<RsvpStatus, 'pending'>) => void;
}) {
  const s = RSVP_STYLE[status];
  return (
    <div className="v a-down" style={{ ...delay(260), backgroundColor: colors.surface, borderRadius: radius.xl, padding: 16, gap: 14, boxShadow: 'var(--shadow-card)' }}>
      <div className="h" style={{ gap: 10 }}>
        <span className="h center" style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: s.bg, flexShrink: 0 }}>
          <Icon name={s.icon} size={18} color={s.fg} />
        </span>
        <div className="v flex1" style={{ gap: 2 }}>
          <Text variant="bodyStrong">
            {status === 'accepted' ? 'You\'re going' : status === 'declined' ? 'You can\'t make it' : 'Will you attend?'}
          </Text>
          <Text variant="small" color={colors.muted}>
            {status === 'pending' ? 'Let your teacher know before class starts.' : 'Your teacher can see your answer.'}
          </Text>
        </div>
      </div>
      <div className="h" style={{ gap: 10 }}>
        <Button title="Decline" icon="close" variant={status === 'declined' ? 'danger' : 'secondary'} disabled={busy} onPress={() => onAnswer('declined')} style={{ flex: 1 }} />
        <Button
          title="Accept"
          icon="checkmark"
          variant={status === 'accepted' ? 'primary' : 'secondary'}
          accent={status === 'accepted' ? colors.success : undefined}
          disabled={busy}
          onPress={() => onAnswer('accepted')}
          style={{ flex: 1 }}
        />
      </div>
    </div>
  );
}

/** Teacher-facing: who's coming at a glance; opens the full list. */
function StudentsSummary({ students, onPress }: { students: RoomStudent[]; onPress: () => void }) {
  const count = (st: RsvpStatus) => students.filter((x) => x.status === st).length;
  return (
    <div className="a-down" style={delay(320)}>
      <Pressable onClick={onPress} scaleTo={0.97} style={{ width: '100%', display: 'flex', flexDirection: 'column', backgroundColor: colors.surface, borderRadius: radius.xl, padding: 16, gap: 14, boxShadow: 'var(--shadow-card)' }}>
        <div className="h" style={{ gap: 10 }}>
          <Icon name="people-outline" size={20} color={colors.primary} />
          <Text variant="bodyStrong" className="flex1">Students · {students.length}</Text>
          <Icon name="chevron-forward" size={18} color={colors.muted} />
        </div>
        {students.length === 0 ? (
          <Text variant="small" color={colors.muted}>Nobody invited yet — share the code or QR to fill the room.</Text>
        ) : (
          <div className="h" style={{ gap: 8 }}>
            {(['accepted', 'pending', 'declined'] as const).map((st) => (
              <div key={st} className="v flex1" style={{ borderRadius: radius.md, padding: '10px 0', alignItems: 'center', backgroundColor: RSVP_STYLE[st].bg }}>
                <Text variant="heading" color={RSVP_STYLE[st].fg}>{count(st)}</Text>
                <Text variant="small" color={RSVP_STYLE[st].fg}>{RSVP_STYLE[st].label}</Text>
              </div>
            ))}
          </div>
        )}
      </Pressable>
    </div>
  );
}

export default function RoomDetails() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const myId = useSession((s) => s.user?.id);
  const isTeacher = useIsTeacher();
  // Any teacher can open the class and use the board, but managing the session
  // (code, roster, starting it) stays with its owner — the server enforces that.
  const { data, loading, error, setData } = useQuery(async () => {
    const room = await api.getRoom(id);
    const students = room.teacher.id === myId ? await api.listRoomStudents(id) : null;
    return { room, students };
  }, [id]);
  const room = data?.room;
  const teacher = !!room && room.teacher.id === myId;
  const [starting, setStarting] = useState(false);
  // On a computer (often a projector) the QR is shown straight away for students to scan.
  const [showQr, setShowQr] = useState(() => window.matchMedia('(min-width: 960px)').matches);
  const [answering, setAnswering] = useState(false);
  const [shared, setShared] = useState(false);

  async function answer(response: Exclude<RsvpStatus, 'pending'>) {
    if (!room) return;
    setAnswering(true);
    try {
      const updated = await api.respondToRoom(room.id, response);
      setData((d) => d && { ...d, room: updated });
    } finally {
      setAnswering(false);
    }
  }

  async function enter() {
    if (!room) return;
    setStarting(true);
    try {
      if (teacher && room.status === 'scheduled') await api.startRoom(room.id);
      navigate(`/classroom/${room.id}`);
    } finally {
      setStarting(false);
    }
  }

  const shareButton = room && (
    <IconButton
      icon={shared ? 'checkmark' : 'share-outline'}
      label="Share invite"
      onPress={async () => {
        if ((await shareText(`Join "${room.title}" on Halaqa. Code: ${room.joinCode}`)) === 'copied') setShared(true);
      }}
    />
  );

  return (
    <Screen right={shareButton} style={{ gap: 24 }}>
      {loading ? (
        <div className="v" style={{ gap: 14 }}><Skeleton height={140} /><Skeleton height={90} /></div>
      ) : error || !room ? (
        <EmptyState icon="alert-circle-outline" title="Room unavailable" body={error ?? 'This room no longer exists.'} />
      ) : (
        <div className="split">
          <div className="split-main">
          <div className="v a-up" style={{ gap: 8 }}>
            {room.status === 'live' && (
              <span className="h" style={{ gap: 8, backgroundColor: colors.dangerSoft, alignSelf: 'flex-start', padding: '6px 12px', borderRadius: radius.pill }}>
                <PulseDot />
                <Text variant="label" color={colors.danger}>Class is live</Text>
              </span>
            )}
            <Text variant="label" color={colors.primary}>{room.subject}</Text>
            <Text variant="display">{room.title}</Text>
            <div className="h" style={{ gap: 10, marginTop: 4 }}>
              <PersonAvatar person={room.teacher} size={32} />
              <Text color={colors.inkSoft}>with {room.teacher.name}</Text>
            </div>
          </div>

          <div className="h" style={{ gap: 10, alignItems: 'stretch' }}>
            <InfoTile icon="calendar-outline" label="Day" value={formatDay(room.startsAt)} delayMs={80} />
            <InfoTile icon="time-outline" label="Starts" value={formatTime(room.startsAt)} delayMs={140} />
            <InfoTile icon="hourglass-outline" label="Length" value={`${room.durationMin} min`} delayMs={200} />
          </div>
          {teacher && showQr && room.status !== 'ended' && <JoinQrPanel kind="room" code={room.joinCode} title={room.title} />}
          </div>

          <div className="split-side">

          {teacher && <CodeCard code={room.joinCode} showQr={showQr} onToggleQr={() => setShowQr((v) => !v)} delayMs={260} />}

          {teacher && data?.students && (
            <StudentsSummary students={data.students} onPress={() => navigate(`/room/students/${room.id}`)} />
          )}

          {!isTeacher && room.myRsvp && room.status !== 'ended' && (
            <RsvpCard status={room.myRsvp} busy={answering} onAnswer={answer} />
          )}

          <div className="a-down" style={{ ...delay(300), position: 'sticky', bottom: 0, marginTop: 'auto', paddingBottom: 16, paddingTop: 8, background: `linear-gradient(transparent, ${colors.bg} 12px)` }}>
            {room.status === 'ended' ? (
              <Button title="This class has ended" variant="secondary" disabled style={{ width: '100%' }} />
            ) : isTeacher ? (
              <Button
                title={room.status === 'live' ? 'Rejoin class' : teacher ? 'Start class now' : 'Open class'}
                icon="videocam"
                accent={colors.teacher}
                loading={starting}
                onPress={enter}
                style={{ width: '100%' }}
              />
            ) : (
              <Button
                title={room.status === 'live' ? 'Join class' : 'Waiting for teacher'}
                icon="enter-outline"
                accent={colors.student}
                disabled={room.status !== 'live'}
                onPress={enter}
                style={{ width: '100%' }}
              />
            )}
          </div>
          </div>
        </div>
      )}
    </Screen>
  );
}
