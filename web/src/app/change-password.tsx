import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModalScreen, Section } from '@/components/ui/screen';
import { api } from '@/lib/api';
import { alert } from '@/lib/dialog';
import { useBack } from '@/lib/navigation';

export default function ChangePassword() {
  const back = useBack('/profile');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate() {
    if (!currentPassword) return 'Enter your current password';
    if (newPassword.length < 6) return 'New password must be at least 6 characters';
    if (newPassword !== confirmPassword) return "New passwords don't match";
    return null;
  }

  async function submit() {
    const validationError = validate();
    if (validationError) return setError(validationError);
    setSaving(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      alert('Password updated', 'Your password has been changed.', [{ text: 'OK', onPress: back }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update your password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalScreen
      title="Change password"
      onClose={back}
      footer={<Button title="Update password" icon="checkmark-circle-outline" loading={saving} onPress={submit} />}
    >
      <Section title="Current password" delayMs={40}>
        <Input value={currentPassword} onChangeText={(t) => { setCurrentPassword(t); setError(null); }}
          placeholder="Your current password" icon="lock-closed-outline" type="password" autoComplete="current-password" autoFocus />
      </Section>
      <Section title="New password" delayMs={100}>
        <Input value={newPassword} onChangeText={(t) => { setNewPassword(t); setError(null); }}
          placeholder="At least 6 characters" icon="key-outline" type="password" autoComplete="new-password" />
        <Input value={confirmPassword} onChangeText={(t) => { setConfirmPassword(t); setError(null); }}
          placeholder="Confirm new password" icon="key-outline" type="password" autoComplete="new-password" onSubmit={submit} error={error} />
      </Section>
    </ModalScreen>
  );
}
