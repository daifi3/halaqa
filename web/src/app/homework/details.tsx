import { useState } from 'react';
import { useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Chip, delay, EmptyState, IconButton, PersonAvatar, Skeleton } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { alert } from '@/lib/dialog';
import { pickFile, toAttachment } from '@/lib/files';
import { formatBytes, formatDay } from '@/lib/format';
import type { Attachment } from '@/lib/types';
import { useQuery } from '@/lib/use-query';
import { useMe } from '@/store/session';
import { colors, radius } from '@/theme';

// Attachments from the server are download links — open them in a new tab.
const openAttachment = (file: Attachment) => {
  if (/^(https?|blob|data):/.test(file.uri)) window.open(file.uri, '_blank', 'noopener');
};

export default function HomeworkDetails() {
  const { id = '' } = useParams();
  const me = useMe();
  // The course teacher sees every submission; a student sees their own.
  const { data, loading, error, setData } = useQuery(async () => {
    const homework = await api.getHomework(id);
    const owner = homework.teacher.id === me.id;
    const [submissions, mine] = await Promise.all([
      owner ? api.listHomeworkSubmissions(id) : Promise.resolve([]),
      owner ? Promise.resolve(null) : api.getMySubmission(id),
    ]);
    return { homework, owner, submissions, mine };
  }, [id]);
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
    const file = await pickFile();
    if (!file) return;
    setAttachment(toAttachment(file));
    setFileChanged(true);
  }

  async function submitWork() {
    setSaving(true);
    try {
      const saved = await api.submitHomework(id, { note: note.trim(), file: fileChanged ? attachment : null, keepAttachment: !!attachment });
      setData((d) => d && { ...d, mine: saved });
      setEditing(false);
    } catch (e) {
      alert('Couldn’t submit', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen style={{ gap: 24, paddingBottom: 40 }}>
      {loading ? (
        <div className="v" style={{ gap: 14 }}><Skeleton height={140} /><Skeleton height={90} /></div>
      ) : !homework ? (
        <EmptyState icon="alert-circle-outline" title="Homework unavailable" body={error ?? 'This assignment no longer exists.'} />
      ) : (
        // Students get their submission in a side panel; the teacher's submissions fill the page.
        <div className={teacher ? 'split-main' : 'split'}>
          <div className="v a-up split-main" style={{ gap: 8 }}>
            <Text variant="label" color={colors.primary}>{homework.courseTitle}</Text>
            <Text variant="display">{homework.title}</Text>
            <Text color={colors.inkSoft} className="pre">{homework.instructions}</Text>
            <div className="h" style={{ gap: 6, marginTop: 4 }}>
              <Icon name="time-outline" size={16} color={overdue ? colors.danger : colors.muted} />
              <Text variant="small" color={overdue ? colors.danger : colors.muted}>{overdue ? 'Was due' : 'Due'} {formatDay(homework.dueAt)}</Text>
            </div>
            <div className="h" style={{ gap: 10 }}>
              <PersonAvatar person={homework.teacher} size={28} />
              <Text color={colors.inkSoft}>Assigned by {homework.teacher.name}</Text>
            </div>
          </div>

          {teacher ? (
            <div className="v a-down" style={{ ...delay(120), gap: 10 }}>
              <Text variant="label" color={colors.muted}>Submissions · {submissions.length}</Text>
              {submissions.length === 0 ? (
                <Text color={colors.muted}>No one has submitted yet.</Text>
              ) : (
                <div className="cards-grid" style={{ gap: 10, alignItems: 'start' }}>{submissions.map((s) => (
                  <div key={s.id} className="v" style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 10 }}>
                    <div className="h" style={{ gap: 10 }}>
                      <PersonAvatar person={s.student} size={32} />
                      <div className="v flex1">
                        <Text variant="bodyStrong">{s.student.name}</Text>
                        <Text variant="small" color={colors.muted}>Submitted {formatDay(s.submittedAt)}</Text>
                      </div>
                      {s.late && <Chip label="Late" icon="time-outline" color={colors.danger} bg={colors.dangerSoft} />}
                    </div>
                    {!!s.note && <Text color={colors.inkSoft} className="pre">{s.note}</Text>}
                    {s.attachment && (
                      <Pressable scaleTo={0.98} onClick={() => openAttachment(s.attachment!)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 10, width: '100%' }}>
                        <Icon name="document-attach-outline" size={16} color={colors.primary} />
                        <Text variant="small" color={colors.primary} lines={1} className="flex1">{s.attachment.name}</Text>
                        <Text variant="small" color={colors.muted}>{formatBytes(s.attachment.size)}</Text>
                      </Pressable>
                    )}
                  </div>
                ))}</div>
              )}
            </div>
          ) : isEditing ? (
            <div className="v a-down split-side" style={{ ...delay(120), gap: 14 }}>
              <Text variant="label" color={colors.muted}>Your submission</Text>
              <Input value={note} onChangeText={setNote} placeholder="Add a note for your teacher (optional)" icon="chatbox-ellipses-outline" multiline minHeight={90} />
              <Button
                title={attachment ? attachment.name : 'Attach a file (optional)'}
                variant="secondary"
                icon={attachment ? 'document-attach' : 'attach-outline'}
                onPress={pickAttachment}
              />
              <Button title="Submit homework" icon="checkmark-circle-outline" loading={saving} onPress={submitWork} />
              {mySubmission && <Button title="Cancel" variant="ghost" onPress={() => setEditing(false)} />}
            </div>
          ) : (
            <div className="split-side"><div className="h a-down" style={{ ...delay(120), alignItems: 'flex-start', gap: 12, backgroundColor: colors.successSoft, borderRadius: radius.lg, padding: 14 }}>
              <Icon name="checkmark-circle" size={22} color={colors.success} />
              <div className="v flex1" style={{ gap: 4 }}>
                <Text variant="bodyStrong" color={colors.success}>Submitted {formatDay(mySubmission!.submittedAt)}</Text>
                {!!mySubmission!.note && <Text color={colors.inkSoft} className="pre">{mySubmission!.note}</Text>}
                {mySubmission!.attachment && (
                  <Pressable scaleTo={0.98} onClick={() => openAttachment(mySubmission!.attachment!)} style={{ alignSelf: 'flex-start' }}>
                    <Text variant="small" color={colors.primary}>{mySubmission!.attachment.name} · {formatBytes(mySubmission!.attachment.size)}</Text>
                  </Pressable>
                )}
                {mySubmission!.late && <Text variant="small" color={colors.danger}>Handed in after the due date</Text>}
              </div>
              <IconButton icon="create-outline" onPress={startEditing} label="Edit submission" />
            </div></div>
          )}
        </div>
      )}
    </Screen>
  );
}
