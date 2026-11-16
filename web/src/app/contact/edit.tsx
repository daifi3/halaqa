import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/misc';
import { ModalScreen, Section } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { isValidEmail } from '@/lib/format';
import { useBack } from '@/lib/navigation';
import type { ContactInput } from '@/lib/types';
import { colors } from '@/theme';

const EMPTY: ContactInput = { name: '', email: '', phone: '', note: '' };

/** New contact, or editing one (`?id=`). */
export default function EditContact() {
  const [params] = useSearchParams();
  const id = params.get('id');
  const navigate = useNavigate();
  const back = useBack('/contacts');
  const [form, setForm] = useState<ContactInput>(EMPTY);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<ContactInput>) => { setForm((f) => ({ ...f, ...patch })); setError(null); };

  useEffect(() => {
    if (!id) return;
    api.getContact(id)
      .then((c) => setForm({ name: c.name, email: c.email ?? '', phone: c.phone ?? '', note: c.note ?? '' }))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the contact'))
      .finally(() => setLoading(false));
  }, [id]);

  const emailOk = !form.email.trim() || isValidEmail(form.email);

  async function save() {
    if (!form.name.trim()) return setError('Give the contact a name');
    if (!emailOk) return setError('That email doesn’t look right');
    setSaving(true);
    try {
      const saved = id ? await api.updateContact(id, form) : await api.createContact(form);
      if (id) back();
      else navigate(`/contact/${saved.id}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the contact');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalScreen
      title={id ? 'Edit contact' : 'New contact'}
      onClose={back}
      footer={<Button title={id ? 'Save changes' : 'Add contact'} icon="checkmark-circle-outline" loading={saving}
        disabled={loading || !form.name.trim()} onPress={save} />}
    >
      {loading ? (
        <div className="v center" style={{ padding: 40 }}><Spinner /></div>
      ) : (
        <>
          <Section title="Who" delayMs={40}>
            <Input label="Name" icon="person-outline" value={form.name} onChangeText={(name) => set({ name })}
              placeholder="e.g. Karim Haddad" autoComplete="off" autoFocus={!id} maxLength={120} />
          </Section>
          <Section title="How to reach them" hint="If this email has a Halaqa account, you can call them from the app." delayMs={100}>
            <Input label="Email" icon="mail-outline" value={form.email} onChangeText={(email) => set({ email })} type="email"
              placeholder="name@example.com" autoComplete="off" maxLength={255} error={!emailOk ? 'That email doesn’t look right' : null} />
            <Input label="Phone" icon="call-outline" value={form.phone} onChangeText={(phone) => set({ phone })} type="tel"
              placeholder="+213 …" maxLength={40} />
          </Section>
          <Section title="Note" delayMs={160}>
            <Input icon="document-text-outline" value={form.note} onChangeText={(note) => set({ note })} multiline
              placeholder="How you know them, best time to call…" maxLength={500} />
          </Section>
          {error && <Text variant="small" color={colors.danger}>{error}</Text>}
        </>
      )}
    </ModalScreen>
  );
}
