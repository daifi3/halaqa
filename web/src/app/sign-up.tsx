import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { AuthArt } from '@/components/auth-art';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { delay, IconButton } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { isValidEmail } from '@/lib/format';
import { useBack } from '@/lib/navigation';
import type { Role } from '@/lib/types';
import { useSession } from '@/store/session';
import { colors } from '@/theme';

export default function SignUp() {
  const [params] = useSearchParams();
  const role: Role = params.get('role') === 'teacher' ? 'teacher' : 'student';
  const accent = role === 'teacher' ? colors.teacher : colors.student;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSession = useSession((s) => s.setSession);
  const back = useBack('/welcome');
  const navigate = useNavigate();
  const { state } = useLocation();

  const passwordsMatch = confirm.length === 0 || password === confirm;
  const canSubmit = name.trim().length >= 2 && isValidEmail(email) && password.length >= 6 && password === confirm;

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    try {
      const session = await api.signUp({ name: name.trim(), email: email.trim().toLowerCase(), password, role });
      setSession(session); // The guest-only route moves on to the app automatically.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="page auth" onSubmit={submit}>
      <AuthArt />
      <div className="content narrow auth-form" style={{ flex: 1, padding: 24, gap: 28 }}>
        <IconButton icon="chevron-back" onPress={back} label="Back" />

        <div className="v a-down" style={{ ...delay(60), gap: 10 }}>
          <span className="h" style={{ gap: 6, alignSelf: 'flex-start', padding: '5px 10px', borderRadius: 999, backgroundColor: accent + '1A' }}>
            <Icon name={role === 'teacher' ? 'school' : 'book'} size={14} color={accent} />
            <Text variant="label" color={accent}>{role === 'teacher' ? 'Teacher' : 'Student'}</Text>
          </span>
          <Text variant="display">Create your<br />account.</Text>
          <Text color={colors.muted}>
            {role === 'teacher' ? 'Your students will see this name in class.' : 'Use the email your teacher invited.'}
          </Text>
        </div>

        <div className="v a-down" style={{ ...delay(160), gap: 16 }}>
          <Input label="Full name" icon="person-outline" accent={accent} value={name} onChangeText={setName}
            placeholder="e.g. Salah Eddine" autoComplete="name" autoFocus />
          <Input label="Email" icon="mail-outline" accent={accent} value={email} onChangeText={setEmail}
            placeholder="you@example.com" type="email" autoComplete="email" error={error} />
          <Input label="Password" icon="lock-closed-outline" accent={accent} value={password} onChangeText={setPassword}
            placeholder="At least 6 characters" type="password" autoComplete="new-password" />
          <Input label="Confirm password" icon="lock-closed-outline" accent={accent} value={confirm} onChangeText={setConfirm}
            placeholder="Type it again" type="password" autoComplete="new-password"
            error={!passwordsMatch ? "Passwords don't match" : null} />
        </div>

        <div className="v a-down" style={{ ...delay(260), marginTop: 'auto', gap: 16 }}>
          <Button type="submit" title="Create account" accent={accent} loading={loading} disabled={!canSubmit} />
          <Pressable onClick={() => navigate('/log-in', { replace: true, state })} style={{ alignSelf: 'center' }}>
            <Text color={colors.muted}>Already have an account? <Text color={accent} variant="bodyStrong">Log in</Text></Text>
          </Pressable>
        </div>
      </div>
    </form>
  );
}
