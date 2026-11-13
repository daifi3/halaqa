import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CreatedCode } from '@/components/created-code';
import { EmailAdder, EmailChips } from '@/components/email-list';
import { Button } from '@/components/ui/button';
import { ChoiceRow } from '@/components/ui/choice';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { ModalScreen, Section } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { formatDay, formatTime, isValidEmail } from '@/lib/format';
import { useBack } from '@/lib/navigation';
import type { Course, Room } from '@/lib/types';
import { colors, radius } from '@/theme';

const SUBJECTS = ['Mathematics', 'Physics', 'Computer Science', 'Languages', 'History', 'Other'];
const DURATIONS = [30, 45, 60, 90, 120];

function nextDays(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function timeSlots() {
  const slots: string[] = [];
  for (let h = 8; h <= 21; h++) for (const m of [0, 30]) slots.push(`${String(h).padStart(2, '0')}:${m === 0 ? '00' : '30'}`);
  return slots;
}

export default function NewRoom() {
  const [params] = useSearchParams();
  const courseId = params.get('courseId');
  const back = useBack();
  const days = useMemo(() => nextDays(14), []);
  const slots = useMemo(() => timeSlots(), []);

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(SUBJECTS[0]!);
  const [day, setDay] = useState(days[0]!.toISOString());
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState(60);
  const [emailDraft, setEmailDraft] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Room | null>(null);
  const [course, setCourse] = useState<Course | null>(null);

  // When scheduling a session under a standing course, prefill its subject —
  // the course's roster already has access, so the email list below becomes optional extras.
  useEffect(() => {
    if (!courseId) return;
    api.getCourse(courseId).then((c) => { setCourse(c); setSubject(c.subject); }).catch(() => {});
  }, [courseId]);

  function addEmail() {
    const e = emailDraft.trim().toLowerCase();
    if (!isValidEmail(e)) return setError('That email looks off');
    if (!emails.includes(e)) setEmails((xs) => [...xs, e]);
    setEmailDraft('');
    setError(null);
  }

  async function submit() {
    const [h, m] = time.split(':').map(Number);
    const startsAt = new Date(day);
    startsAt.setHours(h!, m!, 0, 0);
    setSaving(true);
    try {
      const room = await api.createRoom({
        title: title.trim(), subject, startsAt: startsAt.toISOString(), durationMin: duration, invitedEmails: emails,
        courseId: course?.id,
      });
      setCreated(room);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reserve the room');
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <CreatedCode
        title="Room reserved"
        subtitle={`${created.title} · ${formatDay(created.startsAt)} at ${formatTime(created.startsAt)}`}
        code={created.joinCode}
        shareMessage={`Join my class "${created.title}" on Halaqa — ${formatDay(created.startsAt)} at ${formatTime(created.startsAt)}. Code: ${created.joinCode}`}
        doneLabel="Done"
        onDone={back}
      />
    );
  }

  return (
    <ModalScreen
      title="Reserve a room"
      footer={<Button title="Reserve room" icon="calendar" loading={saving} disabled={title.trim().length < 3} onPress={submit} />}
    >
      {course && (
        <div className="h a-down span-all" style={{ gap: 10, backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: 14 }}>
          <Icon name="library" size={18} color={colors.primary} />
          <Text variant="small" color={colors.primary} className="flex1">
            Scheduling under <Text variant="bodyStrong" color={colors.primary}>{course.title}</Text> — its roster will have access automatically.
          </Text>
        </div>
      )}

      <Section title="Class" delayMs={40}>
        <Input value={title} onChangeText={setTitle} placeholder="What will you teach?" icon="create-outline" autoFocus />
        <ChoiceRow options={SUBJECTS.map((s) => ({ value: s, label: s }))} value={subject} onChange={setSubject} />
      </Section>

      <Section title="Day" delayMs={100}>
        <ChoiceRow
          options={days.map((d) => ({ value: d.toISOString(), sub: d.toLocaleDateString(undefined, { weekday: 'short' }), label: String(d.getDate()) }))}
          value={day}
          onChange={setDay}
        />
      </Section>

      <Section title="Start time" delayMs={160}>
        <ChoiceRow options={slots.map((s) => ({ value: s, label: s }))} value={time} onChange={setTime} />
      </Section>

      <Section title="Duration" delayMs={220}>
        <ChoiceRow wrap options={DURATIONS.map((d) => ({ value: d, label: `${d} min` }))} value={duration} onChange={setDuration} />
      </Section>

      <Section title={`${course ? 'Invite extra guests' : 'Invite students'}${emails.length ? ` · ${emails.length}` : ''}`} delayMs={280}>
        <EmailAdder value={emailDraft} onChange={(t) => { setEmailDraft(t); setError(null); }} onAdd={addEmail} error={error} />
        <EmailChips emails={emails} onRemove={(e) => setEmails((xs) => xs.filter((x) => x !== e))} />
        <Text variant="small" color={colors.muted}>
          {course ? 'Anyone on the course roster already has access — add these only if you want to invite someone extra for this session.' : "You'll also get a join code to share anywhere."}
        </Text>
      </Section>
    </ModalScreen>
  );
}
