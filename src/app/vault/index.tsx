import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VaultDocumentCard } from '@/components/vault-document-card';
import { Button } from '@/components/ui/button';
import { ChoiceRow } from '@/components/ui/choice';
import { EmptyState, IconButton, Skeleton } from '@/components/ui/misc';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/use-query';
import { useSession } from '@/store/session';
import { colors } from '@/theme';

type Tab = 'mine' | 'shared';

export default function Vault() {
  const teacher = useSession((s) => s.user?.role === 'teacher');
  const [tab, setTab] = useState<Tab>('mine');
  const activeTab: Tab = teacher ? tab : 'shared';
  const [folder, setFolder] = useState<string | null>(null);

  // Two independent queries (one per tab) rather than one query re-run on tab
  // change — keeps this simple hook's semantics (load on focus, pull to refresh)
  // without needing a manual reload effect.
  const mineQuery = useQuery(() => (teacher ? api.listMyVault() : Promise.resolve([])));
  const sharedQuery = useQuery(() => api.listSharedWithMe());
  const { data: documents, loading, refreshing, refresh, error } = activeTab === 'mine' ? mineQuery : sharedQuery;

  const folders = [...new Set((documents ?? []).map((d) => d.folder).filter((f): f is string => !!f))];
  const visible = (documents ?? []).filter((d) => !folder || d.folder === folder);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => router.back()} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <Animated.View entering={FadeInUp.duration(400)} style={{ gap: 4 }}>
          <Text variant="title">Vault</Text>
          <Text color={colors.muted}>
            {teacher ? 'Your documents, organized and shared on your terms' : 'Documents your teachers shared with you'}
          </Text>
        </Animated.View>

        {teacher && (
          <ChoiceRow
            options={[{ value: 'mine', label: 'My vault' }, { value: 'shared', label: 'Shared with me' }]}
            value={tab}
            onChange={(v) => { setTab(v); setFolder(null); }}
          />
        )}

        {teacher && tab === 'mine' && <Button title="Upload a document" icon="cloud-upload-outline" onPress={() => router.push('/vault/upload')} />}

        {folders.length > 0 && (
          <ChoiceRow
            options={[{ value: '__all', label: 'All' }, ...folders.map((f) => ({ value: f, label: f }))]}
            value={folder ?? '__all'}
            onChange={(v) => setFolder(v === '__all' ? null : v)}
          />
        )}

        {loading ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={72} />
            <Skeleton height={72} />
          </View>
        ) : error ? (
          <EmptyState icon="cloud-offline-outline" title="Can't reach the server" body={error} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="folder-open-outline"
            title={activeTab === 'mine' ? 'Your vault is empty' : 'Nothing shared yet'}
            body={
              activeTab === 'mine'
                ? 'Upload a document to start organizing your materials.'
                : 'When a teacher shares a document with you, it shows up here.'
            }
          />
        ) : (
          <View style={{ gap: 12 }}>
            {visible.map((doc, i) => (
              <VaultDocumentCard key={doc.id} document={doc} index={i} onPress={() => router.push(`/vault/${doc.id}` as Href)} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 8 },
  content: { padding: 20, gap: 16, paddingBottom: 60 },
});
