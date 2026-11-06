import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExamCard } from '@/components/exam-card';
import { HomeworkCard } from '@/components/homework-card';
import { JoinQrPanel } from '@/components/qr-code';
import { RoomCard } from '@/components/room-card';
import { Input } from '@/components/ui/input';
import { Avatar, EmptyState, IconButton, Skeleton } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { isValidEmail } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import { useSession } from '@/store/session';
import { colors, radius } from '@/theme';

export default function CourseDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useSession((s) => s.user)!;
  const { data, loading, error, setData } = useQuery(() =>
    Promise.all([api.getCourse(id), api.listCourseRooms(id), api.listCourseHomework(id), api.listCourseExams(id)])
      .then(([course, rooms, homework, exams]) => ({ course, rooms, homework, exams })),
  );
  // Only the course's own teacher manages it — other teachers see it as a guest.
  const teacher = data?.course.teacher.id === me.id;
  const homework = data?.homework ?? [];
  const exams = data?.exams ?? [];
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Could not invite');
    } finally {
      setInviting(false);
    }
  }

  const course = data?.course;
  const rooms = data?.rooms ?? [];

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => router.back()} />
        {course && (
          <IconButton
            icon="share-outline"
            onPress={() => Share.share({ message: `Join my course "${course.title}" on Halaqa. Code: ${course.joinCode}` })}
          />
        )}
      </View>

      {loading ? (
        <View style={{ padding: 20, gap: 14 }}><Skeleton height={140} /><Skeleton height={90} /></View>
      ) : error || !course ? (
        <EmptyState icon="alert-circle-outline" title="Course unavailable" body={error ?? 'This course no longer exists.'} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Animated.View entering={FadeInUp} style={{ gap: 8 }}>
            <Text variant="label" color={colors.primary}>{course.subject}</Text>
            <Text variant="display">{course.title}</Text>
            {!!course.description && <Text color={colors.inkSoft}>{course.description}</Text>}
            <View style={styles.teacherRow}>
              <Avatar name={course.teacher.name} size={32} />
              <Text color={colors.inkSoft}>with {course.teacher.name}</Text>
            </View>
          </Animated.View>

          {teacher && (
            <Animated.View entering={FadeInDown.delay(100)} style={styles.codeCard}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="label" color="rgba(255,255,255,0.6)">Join code</Text>
                <Text variant="title" color="#fff" style={{ letterSpacing: 6 }}>{course.joinCode}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <PressableScale style={[styles.copy, showQr && styles.copyActive]} onPress={() => setShowQr((v) => !v)}>
                  <Ionicons name="qr-code-outline" size={18} color={showQr ? '#fff' : colors.ink} />
                </PressableScale>
                <PressableScale
                  style={styles.copy}
                  onPress={async () => { await Clipboard.setStringAsync(course.joinCode); setCopied(true); }}
                >
                  <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={colors.ink} />
                  <Text variant="small">{copied ? 'Copied' : 'Copy'}</Text>
                </PressableScale>
              </View>
            </Animated.View>
          )}

          {teacher && showQr && <JoinQrPanel kind="course" code={course.joinCode} />}

          {teacher && (
            <Animated.View entering={FadeInDown.delay(160)} style={{ gap: 10 }}>
              <Text variant="label" color={colors.muted}>Roster · {course.invitedEmails.length}</Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Input
                    value={emailDraft}
                    onChangeText={(t) => { setEmailDraft(t); setInviteError(null); }}
                    placeholder="Invite another student by email"
                    icon="mail-outline"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onSubmitEditing={invite}
                    returnKeyType="done"
                    error={inviteError}
                  />
                </View>
                <IconButton icon="add" onPress={invite} bg={colors.ink} color="#fff" size={54} />
              </View>
              <Animated.View layout={LinearTransition.springify()} style={{ gap: 8 }}>
                {course.invitedEmails.map((e) => (
                  <Animated.View key={e} entering={ZoomIn} layout={LinearTransition.springify()} style={styles.invite}>
                    <Avatar name={e} size={32} />
                    <Text style={{ flex: 1 }} numberOfLines={1}>{e}</Text>
                    <Ionicons name="mail-outline" size={16} color={colors.muted} />
                  </Animated.View>
                ))}
              </Animated.View>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(220)} style={{ gap: 14 }}>
            <View style={styles.sessionsHeader}>
              <Text variant="label" color={colors.muted}>Sessions · {rooms.length}</Text>
              {teacher && (
                <PressableScale onPress={() => router.push(`/room/new?courseId=${course.id}`)} style={styles.addSession}>
                  <Ionicons name="add" size={16} color={colors.primary} />
                  <Text variant="small" color={colors.primary}>Schedule</Text>
                </PressableScale>
              )}
            </View>
            {rooms.length === 0 ? (
              <Text color={colors.muted}>No sessions scheduled yet.</Text>
            ) : (
              rooms.map((room, i) => (
                <RoomCard key={room.id} room={room} index={i} onPress={() => router.push(`/room/${room.id}`)} />
              ))
            )}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(280)} style={{ gap: 14 }}>
            <View style={styles.sessionsHeader}>
              <Text variant="label" color={colors.muted}>Homework · {homework.length}</Text>
              {teacher && (
                <PressableScale onPress={() => router.push(`/homework/new?courseId=${course.id}`)} style={styles.addSession}>
                  <Ionicons name="add" size={16} color={colors.primary} />
                  <Text variant="small" color={colors.primary}>Assign</Text>
                </PressableScale>
              )}
            </View>
            {homework.length === 0 ? (
              <Text color={colors.muted}>No homework assigned yet.</Text>
            ) : (
              homework.map((hw, i) => (
                <HomeworkCard
                  key={hw.id}
                  homework={hw}
                  index={i}
                  onPress={() => router.push(`/homework/${hw.id}` as Href)}
                  submissionCount={teacher ? hw.submissionCount ?? 0 : undefined}
                  submitted={teacher ? undefined : !!hw.mySubmittedAt}
                />
              ))
            )}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(340)} style={{ gap: 14 }}>
            <View style={styles.sessionsHeader}>
              <Text variant="label" color={colors.muted}>Exams · {exams.length}</Text>
              {teacher && (
                <PressableScale onPress={() => router.push(`/exam/new?courseId=${course.id}` as Href)} style={styles.addSession}>
                  <Ionicons name="add" size={16} color={colors.primary} />
                  <Text variant="small" color={colors.primary}>Create</Text>
                </PressableScale>
              )}
            </View>
            {exams.length === 0 ? (
              <Text color={colors.muted}>No exams yet.</Text>
            ) : (
              exams.map((exam, i) => (
                <ExamCard
                  key={exam.id}
                  exam={exam}
                  index={i}
                  onPress={() => router.push(`/exam/${exam.id}` as Href)}
                  attempt={teacher ? undefined : exam.myAttempt ?? undefined}
                  submissionCount={teacher ? exam.submissionCount ?? 0 : undefined}
                />
              ))
            )}
          </Animated.View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  content: { padding: 20, gap: 24, paddingBottom: 40 },
  teacherRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  codeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.ink, borderRadius: radius.xl, padding: 20 },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill },
  copyActive: { backgroundColor: colors.primary },
  invite: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, padding: 10 },
  sessionsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addSession: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primarySoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
});
