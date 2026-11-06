import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconButton } from '@/components/ui/misc';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { colors } from '@/theme';

function Section({ title, children, delay }: { title: string; children: React.ReactNode; delay: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay)} style={{ gap: 12 }}>
      <Text variant="label" color={colors.muted}>{title}</Text>
      {children}
    </Animated.View>
  );
}

export default function ChangePassword() {
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Password updated', 'Your password has been changed.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update your password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text variant="title">Change password</Text>
        <IconButton icon="close" onPress={() => router.back()} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Section title="Current password" delay={40}>
            <Input
              value={currentPassword}
              onChangeText={(t) => { setCurrentPassword(t); setError(null); }}
              placeholder="Your current password"
              icon="lock-closed-outline"
              secureTextEntry
              autoCapitalize="none"
            />
          </Section>

          <Section title="New password" delay={100}>
            <Input
              value={newPassword}
              onChangeText={(t) => { setNewPassword(t); setError(null); }}
              placeholder="At least 6 characters"
              icon="key-outline"
              secureTextEntry
              autoCapitalize="none"
            />
            <Input
              value={confirmPassword}
              onChangeText={(t) => { setConfirmPassword(t); setError(null); }}
              placeholder="Confirm new password"
              icon="key-outline"
              secureTextEntry
              autoCapitalize="none"
              onSubmitEditing={submit}
              returnKeyType="done"
              error={error}
            />
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>

      <Animated.View entering={FadeInDown.delay(160)} style={styles.footer}>
        <Button title="Update password" icon="checkmark-circle-outline" loading={saving} onPress={submit} />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  content: { padding: 20, gap: 28, paddingBottom: 40 },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
});
