import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconButton } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { isValidEmail } from '@/lib/format';
import { useSession } from '@/store/session';
import { colors } from '@/theme';

export default function LogIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSession = useSession((s) => s.setSession);

  const canSubmit = isValidEmail(email) && password.length > 0;

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const { user, token } = await api.logIn({ email: email.trim().toLowerCase(), password });
      setSession(user, token); // Protected routes switch to the app automatically.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not log in');
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
            <Text variant="display">Welcome{'\n'}back.</Text>
            <Text color={colors.muted}>Log in with the email and password you signed up with.</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(160)} style={{ gap: 16 }}>
            <Input label="Email" icon="mail-outline" value={email} onChangeText={setEmail}
              placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email"
              returnKeyType="next" />
            <Input label="Password" icon="lock-closed-outline" value={password} onChangeText={setPassword}
              placeholder="Your password" secureTextEntry autoCapitalize="none" onSubmitEditing={submit}
              returnKeyType="done" error={error} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(260)} style={{ marginTop: 'auto', gap: 16 }}>
            <Button title="Log in" loading={loading} disabled={!canSubmit} onPress={submit} />
            <PressableScale onPress={() => router.replace('/welcome')} style={{ alignSelf: 'center' }}>
              <Text color={colors.muted}>New to Halaqa? <Text color={colors.primary} variant="bodyStrong">Create an account</Text></Text>
            </PressableScale>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 24, gap: 28 },
});
