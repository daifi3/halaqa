import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Avatar, delay, ToggleRow } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { enroll, authenticate, getBiometricSupport, methodLabel } from '@/lib/biometrics';
import { config } from '@/lib/config';
import { alert } from '@/lib/dialog';
import { pickFile, squareImage } from '@/lib/files';
import { formatDay } from '@/lib/format';
import { biometricRecordOf, useSecurityPrefs } from '@/store/security-prefs';
import { useMe, useSession } from '@/store/session';
import { colors, radius } from '@/theme';
import { PageHeader } from '@/components/ui/screen';
import { TabPage } from './tab-page';

function Row({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="h" style={{ gap: 12, padding: '16px 0' }}>
      <Icon name={icon} size={18} color={colors.muted} />
      <Text color={colors.muted} className="flex1">{label}</Text>
      <Text variant="bodyStrong">{value}</Text>
    </div>
  );
}

function ActionRow({ icon, title, body, tint, onPress }: {
  icon: IconName; title: string; body: string; tint: string; onPress: () => void;
}) {
  return (
    <Pressable onClick={onPress} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14 }}>
      <span className="h center" style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: tint + '22', flexShrink: 0 }}>
        <Icon name={icon} size={20} color={tint} />
      </span>
      <div className="v flex1" style={{ gap: 2 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="small" color={colors.muted}>{body}</Text>
      </div>
      <Icon name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export default function Profile() {
  const user = useMe();
  const updateUser = useSession((s) => s.updateUser);
  const navigate = useNavigate();
  const tone = user.role === 'teacher' ? colors.teacher : colors.student;
  const [uploading, setUploading] = useState(false);
  const biometric = useSecurityPrefs((s) => biometricRecordOf(s, user.id));
  const enableBiometric = useSecurityPrefs((s) => s.enableBiometric);
  const disableBiometric = useSecurityPrefs((s) => s.disableBiometric);
  const label = methodLabel();

  // Turning the lock off needs the owner too, so someone at an unlocked computer can't quietly switch it off.
  async function toggleBiometric(on: boolean) {
    if (on) {
      const support = await getBiometricSupport();
      if (!support.available) {
        alert('Not available here', support.reason ?? 'This device has no unlock the browser can use.');
        return;
      }
      const result = await enroll(user);
      if (result.ok) enableBiometric(user.id, result.credentialId);
      else if (!result.cancelled) alert('Couldn’t turn it on', result.message);
      return;
    }
    if (!biometric.credentialId) return disableBiometric(user.id);
    const result = await authenticate(biometric.credentialId);
    if (result.ok) disableBiometric(user.id);
    else if (!result.cancelled) alert('Couldn’t turn it off', result.message);
  }

  async function pickAvatar() {
    const file = await pickFile('image/*');
    if (!file) return;
    setUploading(true);
    try {
      const square = await squareImage(file);
      const updated = await api.uploadAvatar({ uri: URL.createObjectURL(square), name: square.name, mimeType: square.type, file: square });
      updateUser(updated);
    } catch (e) {
      alert('Could not update photo', e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setUploading(false);
    }
  }

  function removeAvatar() {
    alert('Remove your photo?', 'Your initials will show instead.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          api.removeAvatar().then(updateUser).catch((e) => alert('Could not remove photo', e instanceof Error ? e.message : 'Something went wrong'));
        },
      },
    ]);
  }

  return (
    <TabPage>
      <div className="desktop-only"><PageHeader title="Profile" subtitle="Your account, security and preferences" /></div>
      <div className="split reverse">
      <div className="split-side">
      <div className="v a-zoom profile-card" style={{ alignItems: 'center', gap: 12, paddingTop: 16 }}>
        <Pressable onClick={pickAvatar} disabled={uploading} aria-label="Change profile picture" style={{ position: 'relative', borderRadius: '50%' }}>
          <Avatar name={user.name} size={96} ring={tone} uri={user.avatarUrl} />
          <span className="h center" style={{ position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: tone, border: `2px solid ${colors.bg}` }}>
            <Icon name={uploading ? 'hourglass-outline' : 'camera'} size={14} color="#fff" />
          </span>
        </Pressable>
        <div className="v" style={{ alignItems: 'center', gap: 2 }}>
          <Text variant="title">{user.name}</Text>
          <Text color={colors.muted}>{user.email}</Text>
          {user.avatarUrl && (
            <Pressable onClick={removeAvatar} style={{ marginTop: 4 }}>
              <Text variant="small" color={colors.muted}>Remove photo</Text>
            </Pressable>
          )}
        </div>
      </div>

      <div className="a-down" style={{ ...delay(120), backgroundColor: colors.surface, borderRadius: radius.lg, padding: '0 16px' }}>
        <Row icon="ribbon-outline" label="Role" value={user.role === 'teacher' ? 'Teacher' : 'Student'} />
        <div style={{ height: 1, backgroundColor: colors.line }} />
        <Row icon="server-outline" label="Data source" value={config.useMock ? 'Demo data' : 'Live server'} />
      </div>
      </div>

      <div className="split-main">

      <div className="v a-down" style={{ ...delay(160), gap: 10 }}>
        <ActionRow
          icon="folder-outline"
          tint={colors.primary}
          title={user.role === 'teacher' ? 'My vault' : 'Shared with me'}
          body={user.role === 'teacher' ? 'Organize and share your documents' : 'Documents your teachers shared with you'}
          onPress={() => navigate('/vault')}
        />
        <ActionRow icon="lock-closed-outline" tint={colors.inkSoft} title="Change password" body="Update the password you use to sign in" onPress={() => navigate('/change-password')} />
        <ActionRow icon="notifications-outline" tint={colors.student} title="Notifications" body="Choose what Halaqa should notify you about" onPress={() => navigate('/notifications')} />
      </div>

      <div className="a-down" style={{ ...delay(220), backgroundColor: colors.surface, borderRadius: radius.lg, padding: '0 16px' }}>
        <ToggleRow
          icon="finger-print-outline"
          title={`${label} unlock`}
          body={biometric.enabled && biometric.enabledAt
            ? `On since ${formatDay(biometric.enabledAt)} · asked when you open Halaqa`
            : `Require ${label} to open Halaqa in this browser`}
          value={biometric.enabled}
          onChange={toggleBiometric}
          tint={colors.success}
        />
      </div>

      <div className="a-down" style={{ ...delay(260), marginTop: 12 }}>
        <Button
          title="Sign out"
          variant="secondary"
          icon="log-out-outline"
          className="fit-wide"
          onPress={() =>
            alert('Sign out?', 'You can sign back in at any time.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void api.signOut() },
            ])
          }
        />
      </div>
      </div>
      </div>
    </TabPage>
  );
}
