import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JoinQrPanel } from '@/components/qr-code';
import { Button } from '@/components/ui/button';
import { EmptyState, IconButton, PersonAvatar, PulseDot, Skeleton } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { formatDay, formatTime } from '@/lib/format';
import { RSVP_STYLE } from '@/lib/rsvp';
import type { RoomStudent, RsvpStatus } from '@/lib/types';
import { useQuery } from '@/lib/use-query';
import { useIsTeacher, useSession } from '@/store/session';
import { colors, radius, shadow } from '@/theme';

function InfoTile({ icon, label, value, delay }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; delay: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay)} style={styles.tile}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text variant="small" color={colors.muted}>{label}</Text>
      <Text variant="bodyStrong">{value}</Text>
    </Animated.View>
  );
}

/** Student-facing: answer the invite. Either choice can be changed until the class ends. */
function RsvpCard({ status, busy, onAnswer }: {
  status: RsvpStatus; busy: boolean; onAnswer: (r: Exclude<RsvpStatus, 'pending'>) => void;
}) {
  const s = RSVP_STYLE[status];
  return (
    <Animated.View entering={FadeInDown.delay(260)} layout={LinearTransition.springify()} style={styles.rsvpCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={[styles.rsvpIcon, { backgroundColor: s.bg }]}>
          <Ionicons name={s.icon} size={18} color={s.fg} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">
            {status === 'accepted' ? 'You\'re going' : status === 'declined' ? 'You can\'t make it' : 'Will you attend?'}
          </Text>
          <Text variant="small" color={colors.muted}>
            {status === 'pending' ? 'Let your teacher know before class starts.' : 'Your teacher can see your answer.'}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button
          title="Decline"
          icon="close"
          variant={status === 'declined' ? 'danger' : 'secondary'}
          disabled={busy}
          onPress={() => onAnswer('declined')}
          style={{ flex: 1 }}
        />
        <Button
          title="Accept"
          icon="checkmark"
          variant={status === 'accepted' ? 'primary' : 'secondary'}
          accent={status === 'accepted' ? colors.success : undefined}
          disabled={busy}
          onPress={() => onAnswer('accepted')}
          style={{ flex: 1 }}
        />
      </View>
    </Animated.View>
  );
}

/** Teacher-facing: who's coming at a glance; opens the full list. */
function StudentsSummary({ students, onPress }: { students: RoomStudent[]; onPress: () => void }) {
  const count = (st: RsvpStatus) => students.filter((x) => x.status === st).length;
  return (
    <Animated.View entering={FadeInDown.delay(320)}>
      <PressableScale onPress={onPress} scaleTo={0.97} style={styles.summary}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="people-outline" size={20} color={colors.primary} />
          <Text variant="bodyStrong" style={{ flex: 1 }}>Students · {students.length}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </View>
        {students.length === 0 ? (
          <Text variant="small" color={colors.muted}>Nobody invited yet — share the code or QR to fill the room.</Text>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['accepted', 'pending', 'declined'] as const).map((st) => (
              <View key={st} style={[styles.summaryStat, { backgroundColor: RSVP_STYLE[st].bg }]}>
                <Text variant="heading" color={RSVP_STYLE[st].fg}>{count(st)}</Text>
                <Text variant="small" color={RSVP_STYLE[st].fg}>{RSVP_STYLE[st].label}</Text>
              </View>
            ))}
          </View>
        )}
      </PressableScale>
    </Animated.View>
  );
}

export default function RoomDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const myId = useSession((s) => s.user?.id);
  const isTeacher = useIsTeacher();
  // Any teacher can open the class and use the board, but managing the session
  // (code, roster, starting it) stays with its owner — the server enforces that.
  const { data, loading, error, setData } = useQuery(async () => {
    const room = await api.getRoom(id);
    const students = room.teacher.id === myId ? await api.listRoomStudents(id) : null;
    return { room, students };
  });
  const room = data?.room;
  const teacher = !!room && room.teacher.id === myId;
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [answering, setAnswering] = useState(false);

  async function answer(response: Exclude<RsvpStatus, 'pending'>) {
    if (!room) return;
    setAnswering(true);
    try {
      const updated = await api.respondToRoom(room.id, response);
      setData((d) => d && { ...d, room: updated });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } finally {
      setAnswering(false);
    }
  }

  async function enter() {
    if (!room) return;
    setStarting(true);
    try {
      if (teacher && room.status === 'scheduled') await api.startRoom(room.id);
      router.push(`/classroom/${room.id}`);
    } finally {
      setStarting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => router.back()} />
        {room && (
          <IconButton
            icon="share-outline"
            onPress={() => Share.share({ message: `Join "${room.title}" on Halaqa. Code: ${room.joinCode}` })}
          />
        )}
      </View>

      {loading ? (
        <View style={{ padding: 20, gap: 14 }}><Skeleton height={140} /><Skeleton height={90} /></View>
      ) : error || !room ? (
        <EmptyState icon="alert-circle-outline" title="Room unavailable" body={error ?? 'This room no longer exists.'} />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <Animated.View entering={FadeInUp} style={{ gap: 8 }}>
              {room.status === 'live' && (
                <View style={styles.live}>
                  <PulseDot />
                  <Text variant="label" color={colors.danger}>Class is live</Text>
                </View>
              )}
              <Text variant="label" color={colors.primary}>{room.subject}</Text>
              <Text variant="display">{room.title}</Text>
              <View style={styles.teacherRow}>
                <PersonAvatar person={room.teacher} size={32} />
                <Text color={colors.inkSoft}>with {room.teacher.name}</Text>
              </View>
            </Animated.View>

            <View style={styles.tiles}>
              <InfoTile icon="calendar-outline" label="Day" value={formatDay(room.startsAt)} delay={80} />
              <InfoTile icon="time-outline" label="Starts" value={formatTime(room.startsAt)} delay={140} />
              <InfoTile icon="hourglass-outline" label="Length" value={`${room.durationMin} min`} delay={200} />
            </View>

            {teacher && (
              <Animated.View entering={FadeInDown.delay(260)} style={styles.codeCard}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text variant="label" color="rgba(255,255,255,0.6)">Join code</Text>
                  <Text variant="title" color="#fff" style={{ letterSpacing: 6 }}>{room.joinCode}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <PressableScale style={[styles.copy, showQr && styles.copyActive]} onPress={() => setShowQr((v) => !v)}>
                    <Ionicons name="qr-code-outline" size={18} color={showQr ? '#fff' : colors.ink} />
                  </PressableScale>
                  <PressableScale
                    style={styles.copy}
                    onPress={async () => { await Clipboard.setStringAsync(room.joinCode); setCopied(true); }}
                  >
                    <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={colors.ink} />
                    <Text variant="small">{copied ? 'Copied' : 'Copy'}</Text>
                  </PressableScale>
                </View>
              </Animated.View>
            )}

            {teacher && showQr && room.status !== 'ended' && <JoinQrPanel kind="room" code={room.joinCode} />}

            {teacher && data?.students && (
              <StudentsSummary students={data.students} onPress={() => router.push(`/room/students/${room.id}` as Href)} />
            )}

            {!isTeacher && room.myRsvp && room.status !== 'ended' && (
              <RsvpCard status={room.myRsvp} busy={answering} onAnswer={answer} />
            )}
          </ScrollView>

          <Animated.View entering={FadeInDown.delay(300)} style={styles.footer}>
            {room.status === 'ended' ? (
              <Button title="This class has ended" variant="secondary" disabled />
            ) : isTeacher ? (
              <Button
                title={room.status === 'live' ? 'Rejoin class' : teacher ? 'Start class now' : 'Open class'}
                icon="videocam"
                accent={colors.teacher}
                loading={starting}
                onPress={enter}
              />
            ) : (
              <Button
                title={room.status === 'live' ? 'Join class' : 'Waiting for teacher'}
                icon="enter-outline"
                accent={colors.student}
                disabled={room.status !== 'live'}
                onPress={enter}
              />
            )}
          </Animated.View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  content: { padding: 20, gap: 24 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.dangerSoft, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  teacherRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 4, ...shadow.card },
  codeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.ink, borderRadius: radius.xl, padding: 20 },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill },
  copyActive: { backgroundColor: colors.primary },
  rsvpCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 16, gap: 14, ...shadow.card },
  rsvpIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  summary: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 16, gap: 14, ...shadow.card },
  summaryStat: { flex: 1, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  footer: { paddingHorizontal: 20, paddingBottom: 8, paddingTop: 8 },
});
