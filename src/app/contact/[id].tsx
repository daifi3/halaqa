import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Avatar, EmptyState, IconButton, Skeleton } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { describeCall, isMissed, otherParty } from '@/lib/calls';
import { formatDay, formatTime } from '@/lib/format';
import { openChatWith, startCall } from '@/lib/start-call';
import { useQuery } from '@/lib/use-query';
import { colors, radius, shadow } from '@/theme';

function Action({ icon, label, tint, onPress, disabled }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; tint: string; onPress: () => void; disabled?: boolean;
}) {
  return (
    <PressableScale scaleTo={0.94} onPress={onPress} disabled={disabled} style={[styles.action, disabled && { opacity: 0.4 }]}>
      <View style={[styles.actionIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={20} color="#fff" />
      </View>
      <Text variant="small" color={colors.inkSoft}>{label}</Text>
    </PressableScale>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Ionicons name={icon} size={18} color={colors.muted} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" color={colors.muted}>{label}</Text>
        <Text selectable>{value}</Text>
      </View>
    </View>
  );
}

export default function ContactDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error } = useQuery(() => Promise.all([api.getContact(id), api.listCalls()]));
  const [contact, calls] = data ?? [null, []];
  const history = contact?.user ? calls.filter((c) => otherParty(c).id === contact.user!.id).slice(0, 10) : [];

  function remove() {
    if (!contact) return;
    Alert.alert(`Delete ${contact.name}?`, 'This only removes them from your contacts.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => api.deleteContact(contact.id).then(() => router.back())
          .catch((e) => Alert.alert('Couldn’t delete', e instanceof Error ? e.message : 'Please try again.')),
      },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => router.back()} />
        {contact && <IconButton icon="create-outline" onPress={() => router.push({ pathname: '/contact/edit', params: { id: contact.id } })} />}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <Skeleton height={220} />
        ) : error || !contact ? (
          <EmptyState icon="person-outline" title="Contact not found" body={error ?? 'It may have been deleted.'} />
        ) : (
          <>
            <Animated.View entering={ZoomIn} style={{ alignItems: 'center', gap: 10 }}>
              <Avatar name={contact.name} size={92} uri={contact.user?.avatarUrl} />
              <Text variant="title" style={{ textAlign: 'center' }}>{contact.name}</Text>
              <Text variant="small" color={contact.user ? colors.success : colors.muted}>
                {contact.user ? 'On Halaqa · free audio calls' : 'No Halaqa account for this email'}
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(80)} style={styles.actions}>
              <Action icon="chatbubble-ellipses" label="Message" tint={colors.primary} disabled={!contact.user} onPress={() => openChatWith(contact.user!)} />
              <Action icon="call" label="Call" tint={colors.success} disabled={!contact.user} onPress={() => startCall(contact.user!)} />
              <Action icon="phone-portrait-outline" label="Phone" tint={colors.inkSoft} disabled={!contact.phone}
                onPress={() => Linking.openURL(`tel:${contact.phone!.replace(/[^\d+]/g, '')}`)} />
              <Action icon="mail" label="Email" tint={colors.student} disabled={!contact.email}
                onPress={() => Linking.openURL(`mailto:${contact.email}`)} />
            </Animated.View>

            {(contact.email || contact.phone || contact.note) && (
              <Animated.View entering={FadeInDown.delay(140)} style={styles.card}>
                {contact.email && <InfoRow icon="mail-outline" label="Email" value={contact.email} />}
                {contact.phone && <InfoRow icon="call-outline" label="Phone" value={contact.phone} />}
                {contact.note && <InfoRow icon="document-text-outline" label="Note" value={contact.note} />}
              </Animated.View>
            )}

            {history.length > 0 && (
              <Animated.View entering={FadeInDown.delay(200)} style={{ gap: 10 }}>
                <Text variant="label" color={colors.muted}>Calls</Text>
                <View style={styles.card}>
                  {history.map((c) => (
                    <View key={c.id} style={styles.info}>
                      <Ionicons name={isMissed(c) ? 'call' : c.outgoing ? 'arrow-up' : 'arrow-down'} size={16}
                        color={isMissed(c) ? colors.danger : colors.muted} />
                      <Text style={{ flex: 1 }} color={isMissed(c) ? colors.danger : colors.ink}>{describeCall(c)}</Text>
                      <Text variant="small" color={colors.muted}>{formatDay(c.createdAt)}, {formatTime(c.createdAt)}</Text>
                    </View>
                  ))}
                </View>
              </Animated.View>
            )}

            <Animated.View entering={FadeInDown.delay(240)}>
              <Button title="Delete contact" variant="ghost" icon="trash-outline" onPress={remove} />
            </Animated.View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  content: { padding: 20, gap: 24, paddingBottom: 60 },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  action: { alignItems: 'center', gap: 6 },
  actionIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 16, ...shadow.card },
  info: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
});
