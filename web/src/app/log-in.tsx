import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AuthArt } from '@/components/auth-art';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { delay, IconButton } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { config } from '@/lib/config';
import { isValidEmail } from '@/lib/format';
import { useBack } from '@/lib/navigation';
import { useSession } from '@/store/session';
import { colors, radius } from '@/theme';

export default function LogIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSession = useSession((s) => s.setSession);
  const back = useBack('/welcome');
  const navigate = useNavigate();
  const { state } = useLocation();

  const canSubmit = isValidEmail(email) && password.length > 0;

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    try {
      const session = await api.logIn({ email: email.trim().toLowerCase(), password });
      setSession(session); // The guest-only route moves on to the app automatically.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in');
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
          <Text variant="display">Welcome<br />back.</Text>
          <Text color={colors.muted}>Log in with the email and password you signed up with.</Text>
        </div>

        <div className="v a-down" style={{ ...delay(160), gap: 16 }}>
          <Input label="Email" icon="mail-outline" value={email} onChangeText={setEmail}
            placeholder="you@example.com" type="email" autoComplete="email" autoFocus />
          <Input label="Password" icon="lock-closed-outline" value={password} onChangeText={setPassword}
            placeholder="Your password" type="password" autoComplete="current-password" error={error} />
          {config.useMock && (
            <div className="h" style={{ gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.primarySoft }}>
              <Text variant="small" color={colors.primary}>
                Demo accounts: <Text variant="small" color={colors.primary} style={{ fontWeight: 700 }}>teacher@demo.dz</Text> or{' '}
                <Text variant="small" color={colors.primary} style={{ fontWeight: 700 }}>student@demo.dz</Text>, password demo1234
              </Text>
            </div>
          )}
        </div>

        <div className="v a-down" style={{ ...delay(260), marginTop: 'auto', gap: 16 }}>
          <Button type="submit" title="Log in" loading={loading} disabled={!canSubmit} />
          <Pressable onClick={() => navigate('/welcome', { replace: true, state })} style={{ alignSelf: 'center' }}>
            <Text color={colors.muted}>New to Halaqa? <Text color={colors.primary} variant="bodyStrong">Create an account</Text></Text>
          </Pressable>
        </div>
      </div>
    </form>
  );
}
