import { useState } from 'react';
import { useNavigate } from 'react-router';
import { VaultDocumentCard } from '@/components/cards';
import { Button } from '@/components/ui/button';
import { ChoiceRow } from '@/components/ui/choice';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { PageHeader, Screen } from '@/components/ui/screen';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/use-query';
import { useIsTeacher } from '@/store/session';

type Tab = 'mine' | 'shared';

export default function Vault() {
  const teacher = useIsTeacher();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('mine');
  const activeTab: Tab = teacher ? tab : 'shared';
  const [folder, setFolder] = useState<string | null>(null);

  const mineQuery = useQuery(() => (teacher ? api.listMyVault() : Promise.resolve([])));
  const sharedQuery = useQuery(() => api.listSharedWithMe());
  const { data: documents, loading, error } = activeTab === 'mine' ? mineQuery : sharedQuery;

  const folders = [...new Set((documents ?? []).map((d) => d.folder).filter((f): f is string => !!f))];
  const visible = (documents ?? []).filter((d) => !folder || d.folder === folder);

  return (
    <Screen style={{ gap: 16, paddingBottom: 60 }}>
      <PageHeader
        title="Vault"
        subtitle={teacher ? 'Your documents, organized and shared on your terms' : 'Documents your teachers shared with you'}
        actions={teacher && tab === 'mine' && (
          <Button size="md" icon="cloud-upload-outline" title="Upload a document" onPress={() => navigate('/vault/upload')} />
        )}
      />

      {teacher && (
        <ChoiceRow
          options={[{ value: 'mine', label: 'My vault' }, { value: 'shared', label: 'Shared with me' }]}
          value={tab}
          onChange={(v) => { setTab(v); setFolder(null); }}
        />
      )}

      {teacher && tab === 'mine' && (
        <Button title="Upload a document" icon="cloud-upload-outline" onPress={() => navigate('/vault/upload')} className="mobile-only" />
      )}

      {folders.length > 0 && (
        <ChoiceRow
          options={[{ value: '__all', label: 'All' }, ...folders.map((f) => ({ value: f, label: f }))]}
          value={folder ?? '__all'}
          onChange={(v) => setFolder(v === '__all' ? null : v)}
        />
      )}

      {loading ? (
        <div className="cards-grid dense" style={{ gap: 12 }}><Skeleton height={72} /><Skeleton height={72} /><Skeleton height={72} /></div>
      ) : error ? (
        <EmptyState icon="cloud-offline-outline" title="Can't reach the server" body={error} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="folder-open-outline"
          title={activeTab === 'mine' ? 'Your vault is empty' : 'Nothing shared yet'}
          body={activeTab === 'mine' ? 'Upload a document to start organizing your materials.' : 'When a teacher shares a document with you, it shows up here.'}
        />
      ) : (
        <div className="cards-grid dense" style={{ gap: 12 }}>
          {visible.map((doc, i) => (
            <VaultDocumentCard key={doc.id} document={doc} index={i} onPress={() => navigate(`/vault/${doc.id}`)} />
          ))}
        </div>
      )}
    </Screen>
  );
}
