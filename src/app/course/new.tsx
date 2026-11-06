import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
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
import { isValidEmail } from '@/lib/format';
import type { Course } from '@/lib/types';
import { colors, radius } from '@/theme';

const SUBJECTS = ['Mathematics', 'Physics', 'Computer Science', 'Languages', 'History', 'Other'];

function Section({ title, children, delay }: { title: string; children: React.ReactNode; delay: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay)} style={{ gap: 12 }}>
      <Text variant="label" color={colors.muted}>{title}</Text>
      {children}
    </Animated.View>
  );
}

/** Shown after a course is created: the join code, big and copyable. */
function Created({ course }: { course: Course }) {
  const [copied, setCopied] = useState(false);
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.created}>
      <Animated.View entering={ZoomIn} style={styles.createdIcon}>
        <Ionicons name="checkmark" size={36} color="#fff" />
      </Animated.View>
      <Text variant="title" style={{ textAlign: 'center' }}>Course created</Text>
      <Text color={colors.muted} style={{ textAlign: 'center' }}>{course.title} · {course.subject}</Text>

      <View style={styles.codeBox}>
        <Text variant="label" color={colors.muted}>Join code</Text>
        <View style={styles.codeRow}>
          {course.joinCode.split('').map((c, i) => (
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
            await Clipboard.setStringAsync(course.joinCode);
            setCopied(true);
          }}
        />
        <Button
          title="Share invite"
          icon="share-outline"
          onPress={() => Share.share({ message: `Join my course "${course.title}" on Halaqa. Code: ${course.joinCode}` })}
        />
        <Button title="Open course" variant="ghost" onPress={() => router.replace(`/course/${course.id}`)} />
      </View>
    </Animated.View>
  );
}

export default function NewCourse() {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(SUBJECTS[0]!);
  const [description, setDescription] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Course | null>(null);

  function addEmail() {
    const e = emailDraft.trim().toLowerCase();
    if (!isValidEmail(e)) return setError('That email looks off');
    if (!emails.includes(e)) setEmails((xs) => [...xs, e]);
    setEmailDraft('');
    setError(null);
  }

  async function submit() {
    setSaving(true);
    try {
      const course = await api.createCourse({ title: title.trim(), subject, description: description.trim(), invitedEmails: emails });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setCreated(course);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the course');
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <Created course={created} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text variant="title">New course</Text>
        <IconButton icon="close" onPress={() => router.back()} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Section title="Course" delay={40}>
            <Input value={title} onChangeText={setTitle} placeholder="e.g. Algebra II" icon="create-outline" />
            <ChoiceRow options={SUBJECTS.map((s) => ({ value: s, label: s }))} value={subject} onChange={setSubject} />
          </Section>

          <Section title="Description" delay={100}>
            <Input
              value={description}
              onChangeText={setDescription}
              placeholder="What will students learn?"
              icon="document-text-outline"
              multiline
              style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 14 }}
            />
          </Section>

          <Section title={`Invite students${emails.length ? ` · ${emails.length}` : ''}`} delay={160}>
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
              Everyone on this roster can join every session you schedule under this course — you&apos;ll also get a join code to share anywhere.
            </Text>
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>

      <Animated.View entering={FadeInDown.delay(220)} exiting={FadeOut} style={styles.footer}>
        <Button title="Create course" icon="library" loading={saving} disabled={title.trim().length < 3} onPress={submit} />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  content: { padding: 20, gap: 28, paddingBottom: 40 },
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
