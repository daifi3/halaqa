import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconButton } from '@/components/ui/misc';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { isValidEmail } from '@/lib/format';
import type { ContactInput } from '@/lib/types';
import { colors } from '@/theme';

const EMPTY: ContactInput = { name: '', email: '', phone: '', note: '' };

/** New contact, or editing one (`?id=`). */
export default function EditContact() {
  const { id } = useLocalSearchParams<{ id?: string }>();
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

  const emailOk = !form.email.trim() || isValidEmail(form.email.trim());

  async function save() {
    if (!form.name.trim()) return setError('Give the contact a name');
    if (!emailOk) return setError('That email doesn’t look right');
    setSaving(true);
    try {
      const saved = id ? await api.updateContact(id, form) : await api.createContact(form);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (id) router.back();
      else router.replace(`/contact/${saved.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the contact');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text variant="title">{id ? 'Edit contact' : 'New contact'}</Text>
        <IconButton icon="close" onPress={() => router.back()} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Animated.View entering={FadeInDown.delay(40)} style={{ gap: 16 }}>
              <Input label="Name" icon="person-outline" value={form.name} onChangeText={(name) => set({ name })}
                placeholder="e.g. Karim Haddad" autoCapitalize="words" autoFocus={!id} maxLength={120} returnKeyType="next" />
              <Input label="Email" icon="mail-outline" value={form.email} onChangeText={(email) => set({ email })}
                placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={255}
                error={!emailOk ? 'That email doesn’t look right' : null} />
              <Text variant="small" color={colors.muted} style={{ marginTop: -8 }}>
                If this email has a Halaqa account, you can call them from the app.
              </Text>
              <Input label="Phone" icon="call-outline" value={form.phone} onChangeText={(phone) => set({ phone })}
                placeholder="+213 …" keyboardType="phone-pad" maxLength={40} />
              <Input label="Note" icon="document-text-outline" value={form.note} onChangeText={(note) => set({ note })}
                placeholder="How you know them, best time to call…" multiline maxLength={500} style={{ minHeight: 80, textAlignVertical: 'top' }} />
              {error && <Text variant="small" color={colors.danger}>{error}</Text>}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <View style={styles.footer}>
        <Button title={id ? 'Save changes' : 'Add contact'} icon="checkmark-circle-outline" loading={saving}
          disabled={loading || !form.name.trim()} onPress={save} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  content: { padding: 20, paddingBottom: 40 },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
});
