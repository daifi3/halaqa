import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { iconForMime } from '@/components/cards';
import { EmailAdder, EmailRow } from '@/components/email-list';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Chip, delay, EmptyState, IconButton, PersonAvatar, Skeleton } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { alert } from '@/lib/dialog';
import { formatBytes, formatDay, isValidEmail } from '@/lib/format';
import { viewerKind, viewerPath } from '@/lib/links';
import { useBack } from '@/lib/navigation';
import { useQuery } from '@/lib/use-query';
import { colors } from '@/theme';

export default function VaultDocumentDetails() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const back = useBack('/vault');
  const { data: doc, loading, error, setData } = useQuery(() => api.getVaultDocument(id), [id]);
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
      setData(await api.shareVaultDocument(id, [e]));
      setEmailDraft('');
      setShareError(null);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Could not share');
    } finally {
      setSharing(false);
    }
  }

  async function unshare(email: string) {
    setData(await api.unshareVaultDocument(id, email));
  }

  function openDocument() {
    if (!doc) return;
    const kind = viewerKind(doc.mimeType, doc.url);
    // PDFs and images open in the app; anything else opens in a new tab (or downloads).
    if (kind) navigate(viewerPath({ url: doc.url, title: doc.title, kind }));
    else window.open(doc.url, '_blank', 'noopener');
  }

  function confirmDelete() {
    if (!doc) return;
    alert('Delete document?', `"${doc.title}" will be removed for everyone it was shared with.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await api.deleteVaultDocument(id);
            back();
          } catch (err) {
            alert('Could not delete', err instanceof Error ? err.message : 'Something went wrong');
            setDeleting(false);
          }
        },
      },
    ]);
  }

  const viewable = doc ? !!viewerKind(doc.mimeType, doc.url) : false;

  return (
    <Screen
      right={doc?.canManage && <IconButton icon="trash-outline" onPress={confirmDelete} color={colors.danger} label="Delete document" />}
      style={{ gap: 24, paddingBottom: 40 }}
    >
      {loading ? (
        <div className="v" style={{ gap: 14 }}><Skeleton height={100} /><Skeleton height={140} /></div>
      ) : error || !doc ? (
        <EmptyState icon="alert-circle-outline" title="Document unavailable" body={error ?? 'This document no longer exists.'} />
      ) : (
        <div className={doc.canManage ? 'split' : 'split-main'}>
          <div className="split-main">
          <div className="v a-up" style={{ gap: 12 }}>
            <span className="h center" style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: colors.primarySoft }}>
              <Icon name={iconForMime(doc.mimeType)} size={30} color={colors.primary} />
            </span>
            <Text variant="display" lines={2}>{doc.title}</Text>
            <Text color={colors.muted}>{formatBytes(doc.sizeBytes)} · Added {formatDay(doc.createdAt)}</Text>
            <div className="h" style={{ gap: 10 }}>
              <PersonAvatar person={doc.owner} size={28} />
              <Text color={colors.inkSoft}>{doc.canManage ? 'Uploaded by you' : `Shared by ${doc.owner.name}`}</Text>
            </div>
            {doc.folder && <Chip label={doc.folder} icon="folder-outline" />}
          </div>

          <div className="v a-down" style={delay(80)}>
            <Button title={viewable ? 'View document' : 'Open document'} icon={viewable ? 'eye-outline' : 'open-outline'} onPress={openDocument} className="fit-wide" />
          </div>
          </div>

          {doc.canManage && (
            <div className="v a-down split-side" style={{ ...delay(160), gap: 10 }}>
              <Text variant="label" color={colors.muted}>Shared with · {doc.sharedEmails.length}</Text>
              <EmailAdder
                value={emailDraft}
                onChange={(t) => { setEmailDraft(t); setShareError(null); }}
                onAdd={share}
                placeholder="Share with someone by email"
                error={shareError}
              />
              <div className="v" style={{ gap: 8 }}>
                {doc.sharedEmails.map((e) => (
                  <EmailRow
                    key={e}
                    email={e}
                    trailing={
                      <Pressable onClick={() => void unshare(e)} aria-label={`Stop sharing with ${e}`}>
                        <Icon name="close-circle" size={20} color={colors.muted} />
                      </Pressable>
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {deleting && <Text color={colors.muted} className="a-down">Deleting…</Text>}
        </div>
      )}
    </Screen>
  );
}
