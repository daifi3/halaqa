import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconButton } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { isValidEmail } from '@/lib/format';
import type { Role } from '@/lib/types';
import { useSession } from '@/store/session';
import { colors } from '@/theme';

export default function SignUp() {
  const { role = 'student' } = useLocalSearchParams<{ role: Role }>();
  const accent = role === 'teacher' ? colors.teacher : colors.student;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSession = useSession((s) => s.setSession);

  const passwordsMatch = confirm.length === 0 || password === confirm;
  const canSubmit = name.trim().length >= 2 && isValidEmail(email) && password.length >= 6 && password === confirm;

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const { user, token } = await api.signUp({ name: name.trim(), email: email.trim().toLowerCase(), password, role });
      setSession(user, token); // Protected routes switch to the app automatically.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <IconButton icon="chevron-back" onPress={() => router.back()} />

          <Animated.View entering={FadeInDown.delay(60)} style={{ gap: 10 }}>
            <View style={[styles.badge, { backgroundColor: accent + '1A' }]}>
              <Ionicons name={role === 'teacher' ? 'school' : 'book'} size={14} color={accent} />
              <Text variant="label" color={accent}>{role === 'teacher' ? 'Teacher' : 'Student'}</Text>
            </View>
            <Text variant="display">Create your{'\n'}account.</Text>
            <Text color={colors.muted}>
              {role === 'teacher' ? 'Your students will see this name in class.' : 'Use the email your teacher invited.'}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(160)} style={{ gap: 16 }}>
            <Input label="Full name" icon="person-outline" accent={accent} value={name} onChangeText={setName}
              placeholder="e.g. Salah Eddine" autoCapitalize="words" returnKeyType="next" />
            <Input label="Email" icon="mail-outline" accent={accent} value={email} onChangeText={setEmail}
              placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email"
              returnKeyType="next" error={error} />
            <Input label="Password" icon="lock-closed-outline" accent={accent} value={password} onChangeText={setPassword}
              placeholder="At least 6 characters" secureTextEntry autoCapitalize="none" returnKeyType="next" />
            <Input label="Confirm password" icon="lock-closed-outline" accent={accent} value={confirm} onChangeText={setConfirm}
              placeholder="Type it again" secureTextEntry autoCapitalize="none" onSubmitEditing={submit} returnKeyType="done"
              error={!passwordsMatch ? "Passwords don't match" : null} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(260)} style={{ marginTop: 'auto', gap: 16 }}>
            <Button title="Create account" accent={accent} loading={loading} disabled={!canSubmit} onPress={submit} />
            <PressableScale onPress={() => router.replace('/log-in')} style={{ alignSelf: 'center' }}>
              <Text color={colors.muted}>Already have an account? <Text color={accent} variant="bodyStrong">Log in</Text></Text>
            </PressableScale>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 24, gap: 28 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
});
