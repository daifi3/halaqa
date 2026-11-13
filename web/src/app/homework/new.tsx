import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { ChoiceRow } from '@/components/ui/choice';
import { Input } from '@/components/ui/input';
import { ModalScreen, Section } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { useBack } from '@/lib/navigation';
import { colors } from '@/theme';

function nextDays(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setHours(23, 59, 0, 0);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export default function AssignHomework() {
  const [params] = useSearchParams();
  const courseId = params.get('courseId') ?? '';
  const back = useBack(`/course/${courseId}`);
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
      back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not assign this homework');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalScreen
      title="Assign homework"
      onClose={back}
      footer={<Button title="Assign homework" icon="document-text" loading={saving} disabled={title.trim().length < 3} onPress={submit} />}
    >
      {!!courseTitle && (
        <div className="a-down span-all" style={{ backgroundColor: colors.primarySoft, borderRadius: 14, padding: 14 }}>
          <Text variant="small" color={colors.primary}>
            For <Text variant="bodyStrong" color={colors.primary}>{courseTitle}</Text> — everyone on the roster will see this.
          </Text>
        </div>
      )}

      <Section title="Title" delayMs={40}>
        <Input value={title} onChangeText={setTitle} placeholder="e.g. Balanced binary trees" icon="create-outline" autoFocus />
      </Section>

      <Section title="Instructions" delayMs={100}>
        <Input value={instructions} onChangeText={setInstructions} placeholder="What should students do?" icon="document-text-outline" multiline minHeight={100} />
      </Section>

      <Section title="Due date" delayMs={160}>
        <ChoiceRow
          options={days.map((d) => ({ value: d.toISOString(), sub: d.toLocaleDateString(undefined, { weekday: 'short' }), label: String(d.getDate()) }))}
          value={dueAt}
          onChange={setDueAt}
        />
      </Section>

      {error && <Text variant="small" color={colors.danger}>{error}</Text>}
    </ModalScreen>
  );
}
