import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Chip, EmptyState, IconButton, PersonAvatar, Skeleton } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { formatBytes, formatDay } from '@/lib/format';
import type { Attachment } from '@/lib/types';
import { useQuery } from '@/lib/use-query';
import { useSession } from '@/store/session';
import { colors, radius } from '@/theme';

export default function HomeworkDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useSession((s) => s.user)!;
  // The course teacher sees every submission; a student sees their own.
  const { data, loading, error, setData } = useQuery(async () => {
    const homework = await api.getHomework(id);
    const owner = homework.teacher.id === me.id;
    const [submissions, mine] = await Promise.all([
      owner ? api.listHomeworkSubmissions(id) : Promise.resolve([]),
      owner ? Promise.resolve(null) : api.getMySubmission(id),
    ]);
    return { homework, owner, submissions, mine };
  });
  const homework = data?.homework;
  const teacher = !!data?.owner;
  const submissions = data?.submissions ?? [];
  const mySubmission = data?.mine ?? null;

  const [note, setNote] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  /** A new file was picked in this edit — otherwise the current attachment is kept. */
  const [fileChanged, setFileChanged] = useState(false);
  /** null = automatic: editing until there's a submission. */
  const [editing, setEditing] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [now] = useState(() => Date.now());
  const overdue = !!homework && new Date(homework.dueAt).getTime() < now;
  const isEditing = editing ?? !mySubmission;

  function startEditing() {
    setNote(mySubmission?.note ?? '');
    setAttachment(mySubmission?.attachment ?? null);
    setFileChanged(false);
    setEditing(true);
  }

  async function pickAttachment() {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    const asset = result.assets?.[0];
    if (!asset) return;
    setAttachment({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream', size: asset.size ?? 0 });
    setFileChanged(true);
  }

  async function submitWork() {
    setSaving(true);
    try {
      const saved = await api.submitHomework(id, {
        note: note.trim(),
        file: fileChanged ? attachment : null,
        keepAttachment: !!attachment,
      });
      setData((d) => d && { ...d, mine: saved });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setEditing(false);
    } catch (e) {
      Alert.alert('Couldn’t submit', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // Attachments from the server are download links — open them in the browser or a viewer app.
  const openAttachment = (file: Attachment) => {
    if (/^https?:/.test(file.uri)) Linking.openURL(file.uri).catch(() => Alert.alert('Can’t open this file'));
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ padding: 20, gap: 14 }}><Skeleton height={140} /><Skeleton height={90} /></View>
      </SafeAreaView>
    );
  }

  if (!homework) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.header}><IconButton icon="chevron-back" onPress={() => router.back()} /></View>
        <EmptyState icon="alert-circle-outline" title="Homework unavailable" body={error ?? 'This assignment no longer exists.'} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => router.back()} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInUp} style={{ gap: 8 }}>
          <Text variant="label" color={colors.primary}>{homework.courseTitle}</Text>
          <Text variant="display">{homework.title}</Text>
          <Text color={colors.inkSoft}>{homework.instructions}</Text>
          <View style={styles.dueRow}>
            <Ionicons name="time-outline" size={16} color={overdue ? colors.danger : colors.muted} />
            <Text variant="small" color={overdue ? colors.danger : colors.muted}>
              {overdue ? 'Was due' : 'Due'} {formatDay(homework.dueAt)}
            </Text>
          </View>
          <View style={styles.teacherRow}>
            <PersonAvatar person={homework.teacher} size={28} />
            <Text color={colors.inkSoft}>Assigned by {homework.teacher.name}</Text>
          </View>
        </Animated.View>

        {teacher ? (
          <Animated.View entering={FadeInDown.delay(120)} style={{ gap: 10 }}>
            <Text variant="label" color={colors.muted}>Submissions · {submissions.length}</Text>
            {submissions.length === 0 ? (
              <Text color={colors.muted}>No one has submitted yet.</Text>
            ) : (
              <Animated.View layout={LinearTransition.springify()} style={{ gap: 10 }}>
                {submissions.map((s) => (
                  <Animated.View key={s.id} layout={LinearTransition.springify()} style={styles.submissionCard}>
                    <View style={styles.submissionHeader}>
                      <PersonAvatar person={s.student} size={32} />
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyStrong">{s.student.name}</Text>
                        <Text variant="small" color={colors.muted}>Submitted {formatDay(s.submittedAt)}</Text>
                      </View>
                      {s.late && <Chip label="Late" icon="time-outline" color={colors.danger} bg={colors.dangerSoft} />}
                    </View>
                    {!!s.note && <Text color={colors.inkSoft}>{s.note}</Text>}
                    {s.attachment && (
                      <PressableScale scaleTo={0.98} onPress={() => openAttachment(s.attachment!)} style={styles.attachment}>
                        <Ionicons name="document-attach-outline" size={16} color={colors.primary} />
                        <Text variant="small" color={colors.primary} numberOfLines={1} style={{ flex: 1 }}>{s.attachment.name}</Text>
                        <Text variant="small" color={colors.muted}>{formatBytes(s.attachment.size)}</Text>
                      </PressableScale>
                    )}
                  </Animated.View>
                ))}
              </Animated.View>
            )}
          </Animated.View>
        ) : isEditing ? (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Animated.View entering={FadeInDown.delay(120)} style={{ gap: 14 }}>
              <Text variant="label" color={colors.muted}>Your submission</Text>
              <Input
                value={note}
                onChangeText={setNote}
                placeholder="Add a note for your teacher (optional)"
                icon="chatbox-ellipses-outline"
                multiline
                style={{ minHeight: 90, textAlignVertical: 'top', paddingTop: 14 }}
              />
              <Button
                title={attachment ? attachment.name : 'Attach a file (optional)'}
                variant="secondary"
                icon={attachment ? 'document-attach' : 'attach-outline'}
                onPress={pickAttachment}
              />
              <Button title="Submit homework" icon="checkmark-circle-outline" loading={saving} onPress={submitWork} />
              {mySubmission && <Button title="Cancel" variant="ghost" onPress={() => setEditing(false)} />}
            </Animated.View>
          </KeyboardAvoidingView>
        ) : (
          <Animated.View entering={FadeInDown.delay(120)} style={styles.submittedCard}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="bodyStrong" color={colors.success}>Submitted {formatDay(mySubmission!.submittedAt)}</Text>
              {!!mySubmission!.note && <Text color={colors.inkSoft}>{mySubmission!.note}</Text>}
              {mySubmission!.attachment && (
                <PressableScale scaleTo={0.98} onPress={() => openAttachment(mySubmission!.attachment!)}>
                  <Text variant="small" color={colors.primary}>{mySubmission!.attachment.name} · {formatBytes(mySubmission!.attachment.size)}</Text>
                </PressableScale>
              )}
              {mySubmission!.late && <Text variant="small" color={colors.danger}>Handed in after the due date</Text>}
            </View>
            <IconButton icon="create-outline" onPress={startEditing} />
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 8 },
  content: { padding: 20, gap: 24, paddingBottom: 40 },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  teacherRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  submissionCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 10 },
  submissionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  attachment: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 10 },
  submittedCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: colors.successSoft,
    borderRadius: radius.lg, padding: 14,
  },
});
