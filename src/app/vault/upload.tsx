import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { iconForMime } from '@/components/vault-document-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconButton } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { formatBytes } from '@/lib/format';
import type { PickedFile } from '@/lib/types';
import { colors, radius } from '@/theme';

function Section({ title, children, delay }: { title: string; children: React.ReactNode; delay: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay)} style={{ gap: 12 }}>
      <Text variant="label" color={colors.muted}>{title}</Text>
      {children}
    </Animated.View>
  );
}

export default function UploadToVault() {
  const [picked, setPicked] = useState<(PickedFile & { size: number }) | null>(null);
  const [title, setTitle] = useState('');
  const [folder, setFolder] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    const asset = result.assets?.[0];
    if (!asset) return;
    setPicked({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream', size: asset.size ?? 0 });
    setError(null);
  }

  async function submit() {
    if (!picked) return;
    setSaving(true);
    try {
      await api.uploadVaultDocument({ ...picked, title: title.trim() || undefined, folder: folder.trim() || undefined });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload this file');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text variant="title">Upload document</Text>
        <IconButton icon="close" onPress={() => router.back()} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Section title="File" delay={40}>
            <PressableScale onPress={pickFile} style={styles.picker}>
              {picked ? (
                <>
                  <Ionicons name={iconForMime(picked.mimeType)} size={22} color={colors.primary} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyStrong" numberOfLines={1}>{picked.name}</Text>
                    <Text variant="small" color={colors.muted}>{formatBytes(picked.size)}</Text>
                  </View>
                  <Ionicons name="refresh" size={18} color={colors.muted} />
                </>
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
                  <Text variant="bodyStrong" color={colors.primary}>Choose a file</Text>
                </>
              )}
            </PressableScale>
            {error && <Text variant="small" color={colors.danger}>{error}</Text>}
          </Section>

          <Section title="Title (optional)" delay={100}>
            <Input value={title} onChangeText={setTitle} placeholder={picked?.name ?? 'Defaults to the file name'} icon="create-outline" />
          </Section>

          <Section title="Folder (optional)" delay={160}>
            <Input value={folder} onChangeText={setFolder} placeholder="e.g. Algorithms & Data Structures" icon="folder-outline" />
            <Text variant="small" color={colors.muted}>Group documents under a folder name to organize your vault.</Text>
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>

      <Animated.View entering={FadeInDown.delay(220)} style={styles.footer}>
        <Button title="Upload" icon="cloud-upload" loading={saving} disabled={!picked} onPress={submit} />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  content: { padding: 20, gap: 28, paddingBottom: 40 },
  picker: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, borderStyle: 'dashed',
    paddingHorizontal: 16, paddingVertical: 16,
  },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
});
