import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { ChoiceRow } from '@/components/ui/choice';
import { Input } from '@/components/ui/input';
import { IconButton } from '@/components/ui/misc';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { colors } from '@/theme';

function nextDays(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setHours(23, 59, 0, 0);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function Section({ title, children, delay }: { title: string; children: React.ReactNode; delay: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay)} style={{ gap: 12 }}>
      <Text variant="label" color={colors.muted}>{title}</Text>
      {children}
    </Animated.View>
  );
}

export default function AssignHomework() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const days = useMemo(() => nextDays(21), []);

  const [courseTitle, setCourseTitle] = useState('');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueAt, setDueAt] = useState(days[6]!.toISOString());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getCourse(courseId).then((c) => setCourseTitle(c.title)).catch(() => {});
  }, [courseId]);

  async function submit() {
    setSaving(true);
    try {
      await api.assignHomework(courseId, { title: title.trim(), instructions: instructions.trim(), dueAt });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not assign this homework');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text variant="title">Assign homework</Text>
        <IconButton icon="close" onPress={() => router.back()} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!!courseTitle && (
            <Animated.View entering={FadeInDown} style={styles.courseBanner}>
              <Text variant="small" color={colors.primary}>
                For <Text variant="bodyStrong" color={colors.primary}>{courseTitle}</Text> — everyone on the roster will see this.
              </Text>
            </Animated.View>
          )}

          <Section title="Title" delay={40}>
            <Input value={title} onChangeText={setTitle} placeholder="e.g. Balanced binary trees" icon="create-outline" />
          </Section>

          <Section title="Instructions" delay={100}>
            <Input
              value={instructions}
              onChangeText={setInstructions}
              placeholder="What should students do?"
              icon="document-text-outline"
              multiline
              style={{ minHeight: 100, textAlignVertical: 'top', paddingTop: 14 }}
            />
          </Section>

          <Section title="Due date" delay={160}>
            <ChoiceRow
              options={days.map((d) => ({
                value: d.toISOString(),
                sub: d.toLocaleDateString(undefined, { weekday: 'short' }),
                label: String(d.getDate()),
              }))}
              value={dueAt}
              onChange={setDueAt}
            />
          </Section>

          {error && <Text variant="small" color={colors.danger}>{error}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>

      <Animated.View entering={FadeInDown.delay(220)} style={styles.footer}>
        <Button title="Assign homework" icon="document-text" loading={saving} disabled={title.trim().length < 3} onPress={submit} />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  content: { padding: 20, gap: 28, paddingBottom: 40 },
  courseBanner: { backgroundColor: colors.primarySoft, borderRadius: 14, padding: 14 },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
});
