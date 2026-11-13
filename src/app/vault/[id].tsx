import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, LinearTransition, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { iconForMime } from '@/components/vault-document-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, Chip, EmptyState, IconButton, PersonAvatar, Skeleton } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { formatBytes, formatDay, isValidEmail } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import { openViewer, viewerKind } from '@/lib/viewer';
import { colors, radius } from '@/theme';

export default function VaultDocumentDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: doc, loading, error, setData } = useQuery(() => api.getVaultDocument(id));
  const [emailDraft, setEmailDraft] = useState('');
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function share() {
    if (sharing) return;
    const e = emailDraft.trim().toLowerCase();
    if (!isValidEmail(e)) return setShareError('That email looks off');
    setSharing(true);
    try {
      const updated = await api.shareVaultDocument(id, [e]);
      setData(updated);
      setEmailDraft('');
      setShareError(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Could not share');
    } finally {
      setSharing(false);
    }
  }

  async function unshare(email: string) {
    const updated = await api.unshareVaultDocument(id, email);
    setData(updated);
  }

  function openDocument() {
    if (!doc) return;
    const kind = viewerKind(doc.mimeType, doc.url);
    // PDFs and images open in the app; anything else goes to an app that can read it.
    if (kind) openViewer({ url: doc.url, title: doc.title, kind });
    else Linking.openURL(doc.url).catch(() => Alert.alert('Could not open this file'));
  }

  function confirmDelete() {
    if (!doc) return;
    Alert.alert('Delete document?', `"${doc.title}" will be removed for everyone it was shared with.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await api.deleteVaultDocument(id);
            router.back();
          } catch (err) {
            Alert.alert('Could not delete', err instanceof Error ? err.message : 'Something went wrong');
            setDeleting(false);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => router.back()} />
        {doc?.canManage && <IconButton icon="trash-outline" onPress={confirmDelete} color={colors.danger} />}
      </View>

      {loading ? (
        <View style={{ padding: 20, gap: 14 }}><Skeleton height={100} /><Skeleton height={140} /></View>
      ) : error || !doc ? (
        <EmptyState icon="alert-circle-outline" title="Document unavailable" body={error ?? 'This document no longer exists.'} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Animated.View entering={FadeInUp} style={{ gap: 12 }}>
            <View style={styles.iconBig}>
              <Ionicons name={iconForMime(doc.mimeType)} size={30} color={colors.primary} />
            </View>
            <Text variant="display" numberOfLines={2}>{doc.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text color={colors.muted}>{formatBytes(doc.sizeBytes)} · Added {formatDay(doc.createdAt)}</Text>
            </View>
            <View style={styles.ownerRow}>
              <PersonAvatar person={doc.owner} size={28} />
              <Text color={colors.inkSoft}>{doc.canManage ? 'Uploaded by you' : `Shared by ${doc.owner.name}`}</Text>
            </View>
            {doc.folder && <Chip label={doc.folder} icon="folder-outline" />}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80)}>
            <Button
              title={viewerKind(doc.mimeType, doc.url) ? 'View document' : 'Open document'}
              icon={viewerKind(doc.mimeType, doc.url) ? 'eye-outline' : 'open-outline'}
              onPress={openDocument}
            />
          </Animated.View>

          {doc.canManage && (
            <Animated.View entering={FadeInDown.delay(160)} style={{ gap: 10 }}>
              <Text variant="label" color={colors.muted}>Shared with · {doc.sharedEmails.length}</Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Input
                    value={emailDraft}
                    onChangeText={(t) => { setEmailDraft(t); setShareError(null); }}
                    placeholder="Share with someone by email"
                    icon="mail-outline"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onSubmitEditing={share}
                    returnKeyType="done"
                    error={shareError}
                  />
                </View>
                <IconButton icon="add" onPress={share} bg={colors.ink} color="#fff" size={54} />
              </View>
              <Animated.View layout={LinearTransition.springify()} style={{ gap: 8 }}>
                {doc.sharedEmails.map((e) => (
                  <Animated.View key={e} entering={ZoomIn} exiting={ZoomOut.duration(150)} layout={LinearTransition.springify()} style={styles.shareRow}>
                    <Avatar name={e} size={32} />
                    <Text style={{ flex: 1 }} numberOfLines={1}>{e}</Text>
                    <PressableScale onPress={() => unshare(e)}>
                      <Ionicons name="close-circle" size={20} color={colors.muted} />
                    </PressableScale>
                  </Animated.View>
                ))}
              </Animated.View>
            </Animated.View>
          )}

          {deleting && (
            <Animated.View entering={FadeInDown}>
              <Text color={colors.muted}>Deleting…</Text>
            </Animated.View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  content: { padding: 20, gap: 24, paddingBottom: 40 },
  iconBig: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, padding: 10 },
});
