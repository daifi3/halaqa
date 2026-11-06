import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { ChoiceRow } from '@/components/ui/choice';
import { Input } from '@/components/ui/input';
import { IconButton } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { formatDay, formatTime, isValidEmail } from '@/lib/format';
import type { Course, Room } from '@/lib/types';
import { colors, radius } from '@/theme';

const SUBJECTS = ['Mathematics', 'Physics', 'Computer Science', 'Languages', 'History', 'Other'];
const DURATIONS = [30, 45, 60, 90, 120];

function nextDays(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function timeSlots() {
  const slots: string[] = [];
  for (let h = 8; h <= 21; h++) for (const m of [0, 30]) slots.push(`${String(h).padStart(2, '0')}:${m === 0 ? '00' : '30'}`);
  return slots;
}

function Section({ title, children, delay }: { title: string; children: React.ReactNode; delay: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay)} style={{ gap: 12 }}>
      <Text variant="label" color={colors.muted}>{title}</Text>
      {children}
    </Animated.View>
  );
}

/** Shown after a room is created: the join code, big and copyable. */
function Created({ room }: { room: Room }) {
  const [copied, setCopied] = useState(false);
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.created}>
      <Animated.View entering={ZoomIn} style={styles.createdIcon}>
        <Ionicons name="checkmark" size={36} color="#fff" />
      </Animated.View>
      <Text variant="title" style={{ textAlign: 'center' }}>Room reserved</Text>
      <Text color={colors.muted} style={{ textAlign: 'center' }}>
        {room.title} · {formatDay(room.startsAt)} at {formatTime(room.startsAt)}
      </Text>

      <View style={styles.codeBox}>
        <Text variant="label" color={colors.muted}>Join code</Text>
        <View style={styles.codeRow}>
          {room.joinCode.split('').map((c, i) => (
            <Animated.View key={i} entering={FadeInDown.delay(150 + i * 60)} style={styles.codeCell}>
              <Text variant="title" color={colors.primary}>{c}</Text>
            </Animated.View>
          ))}
        </View>
      </View>

      <View style={{ gap: 10, alignSelf: 'stretch' }}>
        <Button
          title={copied ? 'Copied' : 'Copy code'}
          icon={copied ? 'checkmark' : 'copy-outline'}
          variant="secondary"
          onPress={async () => {
            await Clipboard.setStringAsync(room.joinCode);
            setCopied(true);
          }}
        />
        <Button
          title="Share invite"
          icon="share-outline"
          onPress={() =>
            Share.share({
              message: `Join my class "${room.title}" on Halaqa — ${formatDay(room.startsAt)} at ${formatTime(room.startsAt)}. Code: ${room.joinCode}`,
            })
          }
        />
        <Button title="Done" variant="ghost" onPress={() => router.back()} />
      </View>
    </Animated.View>
  );
}

export default function NewRoom() {
  const { courseId } = useLocalSearchParams<{ courseId?: string }>();
  const days = useMemo(() => nextDays(14), []);
  const slots = useMemo(() => timeSlots(), []);

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(SUBJECTS[0]!);
  const [day, setDay] = useState(days[0]!.toISOString());
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState(60);
  const [emailDraft, setEmailDraft] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Room | null>(null);
  const [course, setCourse] = useState<Course | null>(null);

  // When scheduling a session under a standing course, prefill its subject —
  // the course's roster already has access, so the email list below becomes optional extras.
  useEffect(() => {
    if (!courseId) return;
    api.getCourse(courseId).then((c) => { setCourse(c); setSubject(c.subject); }).catch(() => {});
  }, [courseId]);

  function addEmail() {
    const e = emailDraft.trim().toLowerCase();
    if (!isValidEmail(e)) return setError('That email looks off');
    if (!emails.includes(e)) setEmails((xs) => [...xs, e]);
    setEmailDraft('');
    setError(null);
  }

  async function submit() {
    const [h, m] = time.split(':').map(Number);
    const startsAt = new Date(day);
    startsAt.setHours(h!, m!, 0, 0);
    setSaving(true);
    try {
      const room = await api.createRoom({
        title: title.trim(), subject, startsAt: startsAt.toISOString(), durationMin: duration, invitedEmails: emails,
        courseId: course?.id,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setCreated(room);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reserve the room');
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <Created room={created} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text variant="title">Reserve a room</Text>
        <IconButton icon="close" onPress={() => router.back()} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {course && (
            <Animated.View entering={FadeInDown} style={styles.courseBanner}>
              <Ionicons name="library" size={18} color={colors.primary} />
              <Text variant="small" color={colors.primary} style={{ flex: 1 }}>
                Scheduling under <Text variant="bodyStrong" color={colors.primary}>{course.title}</Text> — its roster will have access automatically.
              </Text>
            </Animated.View>
          )}

          <Section title="Class" delay={40}>
            <Input value={title} onChangeText={setTitle} placeholder="What will you teach?" icon="create-outline" />
            <ChoiceRow options={SUBJECTS.map((s) => ({ value: s, label: s }))} value={subject} onChange={setSubject} />
          </Section>

          <Section title="Day" delay={100}>
            <ChoiceRow
              options={days.map((d) => ({
                value: d.toISOString(),
                sub: d.toLocaleDateString(undefined, { weekday: 'short' }),
                label: String(d.getDate()),
              }))}
              value={day}
              onChange={setDay}
            />
          </Section>

          <Section title="Start time" delay={160}>
            <ChoiceRow options={slots.map((s) => ({ value: s, label: s }))} value={time} onChange={setTime} />
          </Section>

          <Section title="Duration" delay={220}>
            <ChoiceRow wrap options={DURATIONS.map((d) => ({ value: d, label: `${d} min` }))} value={duration} onChange={setDuration} />
          </Section>

          <Section title={`${course ? 'Invite extra guests' : 'Invite students'}${emails.length ? ` · ${emails.length}` : ''}`} delay={280}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Input
                  value={emailDraft}
                  onChangeText={(t) => { setEmailDraft(t); setError(null); }}
                  placeholder="student@email.com"
                  icon="mail-outline"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onSubmitEditing={addEmail}
                  returnKeyType="done"
                  error={error}
                />
              </View>
              <IconButton icon="add" onPress={addEmail} bg={colors.ink} color="#fff" size={54} />
            </View>
            <Animated.View layout={LinearTransition.springify()} style={styles.emails}>
              {emails.map((e) => (
                <Animated.View key={e} entering={ZoomIn} exiting={ZoomOut.duration(150)} layout={LinearTransition.springify()}>
                  <PressableScale style={styles.emailChip} onPress={() => setEmails((xs) => xs.filter((x) => x !== e))}>
                    <Text variant="small" color={colors.primary}>{e}</Text>
                    <Ionicons name="close-circle" size={16} color={colors.primary} />
                  </PressableScale>
                </Animated.View>
              ))}
            </Animated.View>
            <Text variant="small" color={colors.muted}>
              {course ? 'Anyone on the course roster already has access — add these only if you want to invite someone extra for this session.' : "You'll also get a join code to share anywhere."}
            </Text>
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>

      <Animated.View entering={FadeInDown.delay(350)} exiting={FadeOut} style={styles.footer}>
        <Button title="Reserve room" icon="calendar" loading={saving} disabled={title.trim().length < 3} onPress={submit} />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  content: { padding: 20, gap: 28, paddingBottom: 40 },
  courseBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: 14 },
  emails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emailChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primarySoft,
    paddingLeft: 12, paddingRight: 8, paddingVertical: 8, borderRadius: radius.pill,
  },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  created: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  createdIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  codeBox: { alignItems: 'center', gap: 10, marginVertical: 16 },
  codeRow: { flexDirection: 'row', gap: 8 },
  codeCell: { width: 44, height: 54, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
