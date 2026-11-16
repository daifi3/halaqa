import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '@/components/ui/input';
import { Avatar, Chip, EmptyState, IconButton, Skeleton } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { describeCall, isMissed, otherParty } from '@/lib/calls';
import { chatAccent, listTime, previewOf } from '@/lib/direct-chat';
import { formatDay, formatTime } from '@/lib/format';
import { openChatWith, startCall } from '@/lib/start-call';
import type { Call, Contact, Conversation } from '@/lib/types';
import { useIsTyping } from '@/lib/use-conversation';
import { useQuery } from '@/lib/use-query';
import { refreshChats, sortedChats, totalUnread, useChats } from '@/store/chats';
import { useSession } from '@/store/session';
import { colors, fonts, radius, shadow } from '@/theme';

/** Recent calls shown above the contacts. */
const RECENT = 5;

function CallButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <PressableScale scaleTo={0.88} onPress={onPress} style={styles.callBtn} accessibilityLabel={label}>
      <Ionicons name="call" size={18} color="#fff" />
    </PressableScale>
  );
}

function ContactRow({ contact, index }: { contact: Contact; index: number }) {
  const sub = contact.email ?? contact.phone ?? 'No details yet';
  return (
    <Animated.View entering={FadeInDown.delay(60 + Math.min(index, 8) * 40)}>
      <PressableScale scaleTo={0.98} onPress={() => router.push(`/contact/${contact.id}`)} style={styles.row}>
        <Avatar name={contact.name} size={44} uri={contact.user?.avatarUrl} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={1}>{contact.name}</Text>
          <Text variant="small" color={colors.muted} numberOfLines={1}>{sub}</Text>
        </View>
        {contact.user ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton icon="chatbubble-ellipses" size={40} color={colors.primary} bg={colors.primarySoft}
              onPress={() => openChatWith(contact.user!)} />
            <CallButton onPress={() => startCall(contact.user!)} label={`Call ${contact.name}`} />
          </View>
        ) : (
          <Chip label="Not on Halaqa" />
        )}
      </PressableScale>
    </Animated.View>
  );
}

function CallRow({ call }: { call: Call }) {
  const other = otherParty(call);
  const missed = isMissed(call);
  const icon = missed ? 'call' : call.outgoing ? 'arrow-up' : 'arrow-down';
  const tint = missed ? colors.danger : call.answeredAt ? colors.success : colors.muted;
  return (
    <View style={styles.callRow}>
      <View style={[styles.callIcon, { backgroundColor: tint + '1A' }]}>
        <Ionicons name={icon} size={15} color={tint} style={!missed && { transform: [{ rotate: '45deg' }] }} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1} color={missed ? colors.danger : colors.ink}>{other.name}</Text>
        <Text variant="small" color={colors.muted}>{describeCall(call)} · {formatDay(call.createdAt)}, {formatTime(call.createdAt)}</Text>
      </View>
      <IconButton icon="call-outline" size={38} color={colors.success} bg={colors.successSoft} onPress={() => startCall(other)} />
    </View>
  );
}

function ChatRow({ c, myId, index }: { c: Conversation; myId?: string; index: number }) {
  const typing = useIsTyping(useChats((s) => s.typing[c.id] ?? 0));
  const accent = chatAccent(c.theme);
  const unread = c.unread > 0;
  return (
    <Animated.View entering={FadeInDown.delay(40 + Math.min(index, 8) * 40)}>
      <PressableScale scaleTo={0.98} onPress={() => router.push(`/chat/${c.id}`)} style={styles.row}>
        <Avatar name={c.other.name} size={48} uri={c.other.avatarUrl} ring={unread ? accent : undefined} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>{c.other.name}</Text>
            <Text variant="small" color={unread ? accent : colors.muted}>{listTime(c.lastMessageAt ?? c.createdAt)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text variant="small" numberOfLines={1} style={[{ flex: 1 }, unread && { fontFamily: fonts.semibold }]}
              color={typing ? accent : unread ? colors.ink : colors.muted}>
              {typing ? 'typing…' : previewOf(c.lastMessage, myId)}
            </Text>
            {unread && (
              <View style={[styles.unread, { backgroundColor: accent }]}>
                <Text variant="small" color="#fff" style={{ fontSize: 11, lineHeight: 14, fontFamily: fonts.bold }}>{c.unread > 99 ? '99+' : c.unread}</Text>
              </View>
            )}
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

function Segment({ value, onChange, unread }: { value: 'contacts' | 'chats'; onChange: (v: 'contacts' | 'chats') => void; unread: number }) {
  return (
    <View style={styles.segment}>
      {(['contacts', 'chats'] as const).map((v) => (
        <PressableScale key={v} scaleTo={0.96} onPress={() => onChange(v)} style={[styles.segmentBtn, value === v && styles.segmentOn]}>
          <Text variant="bodyStrong" color={value === v ? colors.ink : colors.muted}>{v === 'contacts' ? 'Contacts' : 'Chats'}</Text>
          {v === 'chats' && unread > 0 && (
            <View style={[styles.unread, { backgroundColor: colors.danger }]}>
              <Text variant="small" color="#fff" style={{ fontSize: 11, lineHeight: 14, fontFamily: fonts.bold }}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          )}
        </PressableScale>
      ))}
    </View>
  );
}

export default function Contacts() {
  const { data, loading, refreshing, refresh, error } = useQuery(() => Promise.all([api.listContacts(), api.listCalls()]));
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'contacts' | 'chats'>('contacts');
  const myId = useSession((s) => s.user?.id);
  const conversations = useChats((s) => s.conversations);
  const chatsLoaded = useChats((s) => s.listLoaded);
  const unreadChats = totalUnread(conversations);
  useFocusEffect(useCallback(() => { void refreshChats(); }, []));
  const [contacts, calls] = data ?? [[], []];
  const q = search.trim().toLowerCase();
  const shown = q
    ? contacts.filter((c) => [c.name, c.email, c.phone].some((v) => v?.toLowerCase().includes(q)))
    : contacts;
  const recent = q ? [] : calls.slice(0, RECENT);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { refresh(); void refreshChats(); }} tintColor={colors.primary} />}
      >
        <Animated.View entering={FadeInUp.duration(400)} style={styles.header}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="title">Contacts</Text>
            <Text color={colors.muted}>Your people, and free audio calls.</Text>
          </View>
          <IconButton icon="person-add" bg={colors.inverse} color="#fff" size={48} onPress={() => router.push('/contact/edit')} />
        </Animated.View>

        <Segment value={tab} onChange={setTab} unread={unreadChats} />

        {tab === 'chats' ? (
          !chatsLoaded ? (
            [0, 1, 2].map((i) => <Skeleton key={i} height={72} />)
          ) : sortedChats(conversations).length === 0 ? (
            <EmptyState icon="chatbubbles-outline" title="No chats yet"
              body="Open a contact who's on Halaqa and tap the message button to start chatting." />
          ) : (
            sortedChats(conversations).map((c, i) => <ChatRow key={c.id} c={c} myId={myId} index={i} />)
          )
        ) : (
        <>
        <Input icon="search-outline" value={search} onChangeText={setSearch} placeholder="Search by name, email or phone"
          autoCapitalize="none" autoCorrect={false} returnKeyType="search" />

        {loading ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} height={68} />)
        ) : error ? (
          <EmptyState icon="cloud-offline-outline" title="Can't load contacts" body={error} />
        ) : (
          <>
            {recent.length > 0 && (
              <Animated.View entering={FadeInDown.delay(40)} style={{ gap: 10 }}>
                <Text variant="label" color={colors.muted}>Recent calls</Text>
                <View style={styles.card}>
                  {recent.map((c, i) => (
                    <View key={c.id}>
                      {i > 0 && <View style={styles.sep} />}
                      <CallRow call={c} />
                    </View>
                  ))}
                </View>
              </Animated.View>
            )}

            <View style={{ gap: 10 }}>
              {(recent.length > 0 || q) && (
                <Text variant="label" color={colors.muted}>{q ? `${shown.length} found` : `All contacts · ${contacts.length}`}</Text>
              )}
              {shown.length === 0 ? (
                q ? (
                  <EmptyState icon="search-outline" title="No match" body={`Nobody in your contacts matches “${search.trim()}”.`} />
                ) : (
                  <EmptyState icon="people-outline" title="No contacts yet"
                    body="Add classmates, teachers or parents. Anyone with a Halaqa account can be called from here." />
                )
              ) : (
                shown.map((c, i) => <ContactRow key={c.id} contact={c} index={i} />)
              )}
            </View>
          </>
        )}
        </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 140 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, ...shadow.card },
  callBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 12, ...shadow.card },
  sep: { height: 1, backgroundColor: colors.line, marginLeft: 46 },
  callRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, padding: 4 },
  segmentBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: radius.pill },
  segmentOn: { backgroundColor: colors.surface, ...shadow.card },
  unread: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  callIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
