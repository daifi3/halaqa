import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Avatar, ToggleRow } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { authenticate, getBiometricSupport, methodLabel } from '@/lib/biometrics';
import { config } from '@/lib/config';
import { formatDay } from '@/lib/format';
import { biometricRecordOf, useSecurityPrefs } from '@/store/security-prefs';
import { useSession } from '@/store/session';
import { colors, radius } from '@/theme';

function Row({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.muted} />
      <Text color={colors.muted} style={{ flex: 1 }}>{label}</Text>
      <Text variant="bodyStrong">{value}</Text>
    </View>
  );
}

function ActionRow({ icon, title, body, tint, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; body: string; tint: string; onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} style={styles.actionRow}>
      <View style={[styles.actionIcon, { backgroundColor: tint + '22' }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="small" color={colors.muted}>{body}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </PressableScale>
  );
}

export default function Profile() {
  const user = useSession((s) => s.user)!;
  const updateUser = useSession((s) => s.updateUser);
  const tone = user.role === 'teacher' ? colors.teacher : colors.student;
  const [uploading, setUploading] = useState(false);
  const biometric = useSecurityPrefs((s) => biometricRecordOf(s, user.id));
  const enableBiometric = useSecurityPrefs((s) => s.enableBiometric);
  const disableBiometric = useSecurityPrefs((s) => s.disableBiometric);

  // Turning the lock on or off both need the owner's fingerprint, so someone
  // holding an unlocked phone can't quietly switch it off.
  async function toggleBiometric(on: boolean) {
    if (on) {
      const support = await getBiometricSupport();
      if (!support.available) {
        Alert.alert(
          support.needsAppUpdate ? 'Update Halaqa first'
            : support.needsEnrollment ? 'Set up a fingerprint first' : 'Not available on this phone',
          support.needsAppUpdate
            ? 'This version of Halaqa doesn’t include biometric unlock yet. Install the latest version, then turn this on.'
            : support.needsEnrollment
              ? 'Add a fingerprint or face in your phone’s security settings, then come back and turn this on.'
              : 'This phone has no fingerprint or face sensor that Halaqa can use.',
        );
        return;
      }
      const result = await authenticate(`Confirm your ${methodLabel(support.method).toLowerCase()} to turn on the lock`);
      if (result.ok) enableBiometric(user.id, support.method);
      else if (!result.cancelled) Alert.alert('Couldn’t turn it on', result.message);
      return;
    }
    const result = await authenticate('Confirm it’s you to turn off the lock');
    if (result.ok) disableBiometric(user.id);
    else if (!result.cancelled) Alert.alert('Couldn’t turn it off', result.message);
  }

  async function pickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    const asset = result.assets?.[0];
    if (!asset) return;
    setUploading(true);
    try {
      const updated = await api.uploadAvatar({
        uri: asset.uri,
        name: asset.fileName ?? 'avatar.jpg',
        mimeType: asset.mimeType ?? 'image/jpeg',
      });
      updateUser(updated);
    } catch (e) {
      Alert.alert('Could not update photo', e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setUploading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View style={styles.content}>
        <Animated.View entering={ZoomIn} style={{ alignItems: 'center', gap: 12 }}>
          <PressableScale onPress={pickAvatar} disabled={uploading} style={styles.avatarWrap}>
            <Avatar name={user.name} size={96} ring={tone} uri={user.avatarUrl} />
            <View style={[styles.avatarBadge, { backgroundColor: tone }]}>
              <Ionicons name={uploading ? 'hourglass-outline' : 'camera'} size={14} color="#fff" />
            </View>
          </PressableScale>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Text variant="title">{user.name}</Text>
            <Text color={colors.muted}>{user.email}</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120)} style={styles.card}>
          <Row icon="ribbon-outline" label="Role" value={user.role === 'teacher' ? 'Teacher' : 'Student'} />
          <View style={styles.sep} />
          <Row icon="server-outline" label="Data source" value={config.useMock ? 'Demo data' : 'Live server'} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160)} style={{ gap: 10 }}>
          <ActionRow
            icon="folder-outline"
            tint={colors.primary}
            title={user.role === 'teacher' ? 'My vault' : 'Shared with me'}
            body={user.role === 'teacher' ? 'Organize and share your documents' : 'Documents your teachers shared with you'}
            // Typed routes doesn't yet resolve this nested index route's collapsed path — cast is safe, confirmed working at runtime.
            onPress={() => router.push('/vault' as Href)}
          />
          <ActionRow
            icon="lock-closed-outline"
            tint={colors.inkSoft}
            title="Change password"
            body="Update the password you use to sign in"
            onPress={() => router.push('/change-password')}
          />
          <ActionRow
            icon="notifications-outline"
            tint={colors.student}
            title="Notifications"
            body="Choose what Halaqa should notify you about"
            onPress={() => router.push('/notifications')}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220)} style={styles.card}>
          <ToggleRow
            icon="finger-print-outline"
            title={biometric.enabled ? `${methodLabel(biometric.method)} unlock` : 'Fingerprint unlock'}
            body={biometric.enabled && biometric.enabledAt
              ? `On since ${formatDay(biometric.enabledAt)} · asked when you open Halaqa`
              : 'Require your fingerprint to open Halaqa'}
            value={biometric.enabled}
            onChange={toggleBiometric}
            tint={colors.success}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(260)} style={{ marginTop: 'auto', marginBottom: 120 }}>
          <Button
            title="Sign out"
            variant="secondary"
            icon="log-out-outline"
            onPress={() =>
              Alert.alert('Sign out?', 'You can sign back in at any time.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: () => void api.signOut() },
              ])
            }
          />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: 20, gap: 20, paddingTop: 36 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  sep: { height: 1, backgroundColor: colors.line },
  avatarWrap: { alignItems: 'center', justifyContent: 'center' },
  avatarBadge: {
    position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg,
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: 14,
  },
  actionIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
