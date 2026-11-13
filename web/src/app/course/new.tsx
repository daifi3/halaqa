import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CreatedCode } from '@/components/created-code';
import { EmailAdder, EmailChips } from '@/components/email-list';
import { Button } from '@/components/ui/button';
import { ChoiceRow } from '@/components/ui/choice';
import { Input } from '@/components/ui/input';
import { ModalScreen, Section } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { isValidEmail } from '@/lib/format';
import type { Course } from '@/lib/types';
import { colors } from '@/theme';

const SUBJECTS = ['Mathematics', 'Physics', 'Computer Science', 'Languages', 'History', 'Other'];

export default function NewCourse() {
  const navigate = useNavigate();
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
      setCreated(await api.createCourse({ title: title.trim(), subject, description: description.trim(), invitedEmails: emails }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the course');
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <CreatedCode
        title="Course created"
        subtitle={`${created.title} · ${created.subject}`}
        code={created.joinCode}
        shareMessage={`Join my course "${created.title}" on Halaqa. Code: ${created.joinCode}`}
        doneLabel="Open course"
        onDone={() => navigate(`/course/${created.id}`, { replace: true })}
      />
    );
  }

  return (
    <ModalScreen
      title="New course"
      footer={<Button title="Create course" icon="library" loading={saving} disabled={title.trim().length < 3} onPress={submit} />}
    >
      <Section title="Course" delayMs={40}>
        <Input value={title} onChangeText={setTitle} placeholder="e.g. Algebra II" icon="create-outline" autoFocus />
        <ChoiceRow options={SUBJECTS.map((s) => ({ value: s, label: s }))} value={subject} onChange={setSubject} />
      </Section>

      <Section title="Description" delayMs={100}>
        <Input value={description} onChangeText={setDescription} placeholder="What will students learn?" icon="document-text-outline" multiline />
      </Section>

      <Section title={`Invite students${emails.length ? ` · ${emails.length}` : ''}`} delayMs={160}>
        <EmailAdder value={emailDraft} onChange={(t) => { setEmailDraft(t); setError(null); }} onAdd={addEmail} error={error} />
        <EmailChips emails={emails} onRemove={(e) => setEmails((xs) => xs.filter((x) => x !== e))} />
        <Text variant="small" color={colors.muted}>
          Everyone on this roster can join every session you schedule under this course — you&apos;ll also get a join code to share anywhere.
        </Text>
      </Section>
    </ModalScreen>
  );
}
