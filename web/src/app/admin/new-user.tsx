import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { ChoiceRow } from '@/components/ui/choice';
import { Pressable } from '@/components/ui/pressable';
import { ModalScreen, Section } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { isValidEmail } from '@/lib/format';
import { copyText } from '@/lib/links';
import { useBack } from '@/lib/navigation';
import { ROLE_ORDER, ROLES } from '@/lib/roles';
import type { CreatedUser, DemoRequest, Role } from '@/lib/types';
import { colors, radius } from '@/theme';

/** The message an admin sends a new user: where to sign in, and with what. */
function welcomeMessage(c: CreatedUser) {
  return `Welcome to Halaqa, ${c.user.name.split(' ')[0]}!\n\nSign in at ${window.location.origin}/log-in\nEmail: ${c.user.email}\n`
    + `Temporary password: ${c.temporaryPassword}\n\nPlease change your password after signing in (Profile > Change password).`;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="h" style={{ gap: 12, padding: '12px 14px', borderRadius: radius.md, backgroundColor: colors.bg }}>
      <div className="v flex1" style={{ gap: 2, minWidth: 0 }}>
        <Text variant="label" color={colors.muted}>{label}</Text>
        <Text variant="bodyStrong" lines={1} style={{ fontFamily: label === 'Password' ? 'ui-monospace, monospace' : undefined }}>{value}</Text>
      </div>
      <Pressable scaleTo={0.92} onClick={async () => { await copyText(value); setCopied(true); setTimeout(() => setCopied(false), 1600); }}
        aria-label={`Copy ${label.toLowerCase()}`}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 999,
          backgroundColor: copied ? colors.successSoft : colors.surface }}>
        <Icon name={copied ? 'checkmark' : 'copy-outline'} size={16} color={copied ? colors.success : colors.ink} />
        <Text variant="small" color={copied ? colors.success : colors.ink}>{copied ? 'Copied' : 'Copy'}</Text>
      </Pressable>
    </div>
  );
}

/** Admin: create an account (optionally answering a demo request, `?request=`), then hand over the credentials. */
export default function NewUser() {
  const [params] = useSearchParams();
  const requestId = params.get('request');
  const navigate = useNavigate();
  const back = useBack('/admin/users');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('teacher');
  const [mode, setMode] = useState<'generate' | 'custom'>('generate');
  const [password, setPassword] = useState('');
  const [request, setRequest] = useState<DemoRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedUser | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // From a demo request: fill in who asked.
  useEffect(() => {
    if (!requestId) return;
    api.listDemoRequests().then((all) => {
      const r = all.find((x) => x.id === requestId);
      if (!r) return;
      setRequest(r);
      setName(r.name);
      setEmail(r.email);
    }).catch(() => {});
  }, [requestId]);

  const emailOk = isValidEmail(email.trim());
  const passwordOk = mode === 'generate' || password.length >= 6;
  const canSave = name.trim().length >= 2 && emailOk && passwordOk;

  async function save() {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      setCreated(await api.createUser({
        name: name.trim(), email: email.trim().toLowerCase(), role,
        password: mode === 'custom' ? password : undefined, demoRequestId: request?.id,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the account');
    } finally {
      setSaving(false);
    }
  }

  function another() {
    setCreated(null); setName(''); setEmail(''); setPassword(''); setMode('generate'); setRequest(null); setCopiedAll(false);
    if (requestId) navigate('/admin/users/new', { replace: true });
  }

  if (created) {
    const r = ROLES[created.user.role];
    return (
      <ModalScreen title="Account created" onClose={() => navigate('/admin/users')}
        footer={<div className="h" style={{ gap: 10, width: '100%' }}>
          <Button title="Create another" variant="secondary" icon="person-add-outline" onPress={another} style={{ flex: 1 }} />
          <Button title="Done" icon="checkmark" onPress={() => navigate('/admin/users')} style={{ flex: 1 }} />
        </div>}>
        <div className="v a-zoom" style={{ gap: 10, alignItems: 'center', padding: '12px 0 4px' }}>
          <span className="h center" style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.success }}>
            <Icon name="checkmark" size={32} color="#fff" />
          </span>
          <Text variant="heading">{created.user.name}</Text>
          <span className="h" style={{ gap: 6, padding: '4px 10px', borderRadius: 999, backgroundColor: r.soft }}>
            <Icon name={r.icon} size={13} color={r.tone} />
            <Text variant="small" color={r.tone}>{r.label}</Text>
          </span>
        </div>
        <Section title="Sign-in details" hint="The password is shown only now. Send it to them privately; they can change it after signing in." delayMs={80}>
          <CopyRow label="Email" value={created.user.email} />
          <CopyRow label="Password" value={created.temporaryPassword} />
          <Button title={copiedAll ? 'Message copied' : 'Copy a welcome message'} variant="secondary"
            icon={copiedAll ? 'checkmark' : 'chatbox-ellipses-outline'}
            onPress={async () => { await copyText(welcomeMessage(created)); setCopiedAll(true); }} />
        </Section>
      </ModalScreen>
    );
  }

  return (
    <ModalScreen title="Create user" onClose={back}
      footer={<Button title="Create account" icon="person-add" loading={saving} disabled={!canSave} onPress={save} />}>
      {request && (
        <div className="h a-down" style={{ gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.primarySoft }}>
          <Icon name="mail-open-outline" size={18} color={colors.primary} />
          <Text variant="small" color={colors.primary} style={{ flex: 1 }}>
            From {request.name}'s demo request{request.organization ? ` (${request.organization})` : ''}. It will be marked “account created”.
          </Text>
        </div>
      )}
      <Section title="Who" delayMs={40}>
        <Input label="Full name" icon="person-outline" value={name} onChangeText={(v) => { setName(v); setError(null); }}
          placeholder="e.g. Sara Belkacem" autoComplete="off" autoFocus={!requestId} maxLength={120} />
        <Input label="Email" icon="mail-outline" value={email} onChangeText={(v) => { setEmail(v); setError(null); }} type="email"
          placeholder="name@school.dz" autoComplete="off" maxLength={255}
          error={email.trim() && !emailOk ? 'That email doesn’t look right' : null} />
      </Section>

      <Section title="Role" hint={ROLES[role].hint} delayMs={100}>
        <ChoiceRow<Role> value={role} onChange={setRole} accent={ROLES[role].tone}
          options={ROLE_ORDER.map((r) => ({ value: r, label: ROLES[r].label }))} />
        {role === 'admin' && (
          <Text variant="small" color={colors.danger}>Admins can create accounts and change anyone's role. Only give this to Halaqa staff.</Text>
        )}
      </Section>

      <Section title="Password" hint="They can change it after signing in (Profile > Change password)." delayMs={160}>
        <ChoiceRow<'generate' | 'custom'> value={mode} onChange={setMode} options={[
          { value: 'generate', label: 'Generate one' },
          { value: 'custom', label: 'Set it myself' },
        ]} />
        {mode === 'custom' && (
          <Input label="Temporary password" icon="lock-closed-outline" value={password} onChangeText={setPassword}
            type="password" placeholder="At least 6 characters" autoComplete="new-password" maxLength={72}
            error={password && password.length < 6 ? 'At least 6 characters' : null} />
        )}
      </Section>
      {error && <Text variant="small" color={colors.danger}>{error}</Text>}
    </ModalScreen>
  );
}
