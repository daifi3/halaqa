import { useState, type DragEvent } from 'react';
import { iconForMime } from '@/components/cards';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Pressable } from '@/components/ui/pressable';
import { ModalScreen, Section } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { pickFile, toAttachment } from '@/lib/files';
import { formatBytes } from '@/lib/format';
import { useBack } from '@/lib/navigation';
import type { Attachment } from '@/lib/types';
import { colors, radius } from '@/theme';

export default function UploadToVault() {
  const back = useBack('/vault');
  const [picked, setPicked] = useState<Attachment | null>(null);
  const [title, setTitle] = useState('');
  const [folder, setFolder] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const choose = (file: File | null | undefined) => {
    if (!file) return;
    setPicked(toAttachment(file));
    setError(null);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    choose(e.dataTransfer.files[0]);
  };

  async function submit() {
    if (!picked) return;
    setSaving(true);
    try {
      await api.uploadVaultDocument({ ...picked, title: title.trim() || undefined, folder: folder.trim() || undefined });
      back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload this file');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalScreen
      title="Upload document"
      onClose={back}
      footer={<Button title="Upload" icon="cloud-upload" loading={saving} disabled={!picked} onPress={submit} />}
    >
      <Section wide title="File" delayMs={40}>
        <Pressable
          onClick={async () => choose(await pickFile())}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          scaleTo={0.98}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%', backgroundColor: dragging ? colors.primarySoft : colors.surface,
            borderRadius: radius.md, border: `1.5px dashed ${dragging ? colors.primary : colors.line}`, padding: 16,
          }}
        >
          {picked ? (
            <>
              <Icon name={iconForMime(picked.mimeType)} size={22} color={colors.primary} />
              <div className="v flex1" style={{ gap: 2 }}>
                <Text variant="bodyStrong" lines={1}>{picked.name}</Text>
                <Text variant="small" color={colors.muted}>{formatBytes(picked.size)}</Text>
              </div>
              <Icon name="refresh" size={18} color={colors.muted} />
            </>
          ) : (
            <>
              <Icon name="cloud-upload-outline" size={22} color={colors.primary} />
              <Text variant="bodyStrong" color={colors.primary}>Choose a file</Text>
              <Text variant="small" color={colors.muted} style={{ marginLeft: 'auto' }}>or drop it here</Text>
            </>
          )}
        </Pressable>
        {error && <Text variant="small" color={colors.danger}>{error}</Text>}
      </Section>

      <Section title="Title (optional)" delayMs={100}>
        <Input value={title} onChangeText={setTitle} placeholder={picked?.name ?? 'Defaults to the file name'} icon="create-outline" />
      </Section>

      <Section title="Folder (optional)" delayMs={160}>
        <Input value={folder} onChangeText={setFolder} placeholder="e.g. Algorithms & Data Structures" icon="folder-outline" />
        <Text variant="small" color={colors.muted}>Group documents under a folder name to organize your vault.</Text>
      </Section>
    </ModalScreen>
  );
}
