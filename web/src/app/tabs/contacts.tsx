import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Avatar, Chip, delay, EmptyState, IconButton, Skeleton } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { PageHeader } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { describeCall, isMissed, otherParty } from '@/lib/calls';
import { formatDay, formatTime } from '@/lib/format';
import type { Call, Contact } from '@/lib/types';
import { useOpenChat } from '@/components/chat/chat-widget';
import { useStartCall } from '@/lib/use-calls';
import { useQuery } from '@/lib/use-query';
import { colors, radius } from '@/theme';
import { TabPage } from './tab-page';

/** Recent calls shown above the contacts. */
const RECENT = 5;

function ContactRow({ contact, index, onCall, onMessage }: { contact: Contact; index: number; onCall: () => void; onMessage: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="a-down h" style={{
      ...delay(60 + Math.min(index, 8) * 40), gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg,
      padding: 12, boxShadow: 'var(--shadow-card)',
    }}>
      <Pressable hover={false} scaleTo={0.99} onClick={() => navigate(`/contact/${contact.id}`)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, background: 'transparent', textAlign: 'left' }}>
        <Avatar name={contact.name} size={44} uri={contact.user?.avatarUrl} />
        <span className="v flex1" style={{ gap: 2 }}>
          <Text variant="bodyStrong" lines={1}>{contact.name}</Text>
          <Text variant="small" color={colors.muted} lines={1}>{contact.email ?? contact.phone ?? 'No details yet'}</Text>
        </span>
      </Pressable>
      {contact.user ? (
        <span className="h" style={{ gap: 8 }}>
          <IconButton icon="chatbubble-ellipses" label={`Message ${contact.name}`} size={40} bg={colors.primarySoft} color={colors.primary} onPress={onMessage} />
          <IconButton icon="call" label={`Call ${contact.name}`} size={40} bg={colors.success} color="#fff" onPress={onCall} />
        </span>
      ) : (
        <Chip label="Not on Halaqa" />
      )}
    </div>
  );
}

function CallRow({ call, onCall }: { call: Call; onCall: () => void }) {
  const other = otherParty(call);
  const missed = isMissed(call);
  const tint = missed ? colors.danger : call.answeredAt ? colors.success : colors.muted;
  return (
    <div className="h" style={{ gap: 12, padding: '12px 0' }}>
      <span className="h center" style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: tint + '1A', flexShrink: 0 }}>
        <Icon name={missed ? 'call' : call.outgoing ? 'arrow-up' : 'arrow-down'} size={15} color={tint}
          style={missed ? undefined : { transform: 'rotate(45deg)' }} />
      </span>
      <div className="v flex1" style={{ gap: 1 }}>
        <Text variant="bodyStrong" lines={1} color={missed ? colors.danger : colors.ink}>{other.name}</Text>
        <Text variant="small" color={colors.muted}>{describeCall(call)} · {formatDay(call.createdAt)}, {formatTime(call.createdAt)}</Text>
      </div>
      <IconButton icon="call-outline" label={`Call ${other.name} back`} size={38} color={colors.success} bg={colors.successSoft} onPress={onCall} />
    </div>
  );
}

export default function Contacts() {
  const navigate = useNavigate();
  const startCall = useStartCall();
  const openChat = useOpenChat();
  const { data, loading, error, refresh, refreshing } = useQuery(() => Promise.all([api.listContacts(), api.listCalls()]));
  const [search, setSearch] = useState('');
  const [contacts, calls] = data ?? [[], []];
  const q = search.trim().toLowerCase();
  const shown = q ? contacts.filter((c) => [c.name, c.email, c.phone].some((v) => v?.toLowerCase().includes(q))) : contacts;
  const recent = q ? [] : calls.slice(0, RECENT);

  return (
    <TabPage onRefresh={refresh} refreshing={refreshing} gap={16}>
      <div className="h" style={{ gap: 12, alignItems: 'flex-start' }}>
        <div className="flex1"><PageHeader title="Contacts" subtitle="Your people, and free audio calls." /></div>
        <IconButton icon="person-add" label="Add contact" bg={colors.inverse} color="#fff" size={48} onPress={() => navigate('/contact/edit')}
          style={{ marginTop: 14, marginRight: 44 }} />
      </div>

      <Input icon="search-outline" value={search} onChangeText={setSearch} placeholder="Search by name, email or phone"
        autoCapitalize="none" autoCorrect="off" type="search" aria-label="Search contacts" />

      {loading ? (
        <div className="v" style={{ gap: 12 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={68} />)}</div>
      ) : error ? (
        <EmptyState icon="cloud-offline-outline" title="Can't load contacts" body={error} />
      ) : (
        <>
          {recent.length > 0 && (
            <section className="v a-down" style={{ gap: 10 }}>
              <Text variant="label" color={colors.muted}>Recent calls</Text>
              <div style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: '0 12px', boxShadow: 'var(--shadow-card)' }}>
                {recent.map((c, i) => (
                  <div key={c.id} style={{ borderTop: i ? `1px solid ${colors.line}` : undefined }}>
                    <CallRow call={c} onCall={() => startCall(otherParty(c))} />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="v" style={{ gap: 10 }}>
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
              <div className="cards-grid dense" style={{ gap: 12 }}>
                {shown.map((c, i) => <ContactRow key={c.id} contact={c} index={i} onCall={() => startCall(c.user!)} onMessage={() => void openChat(c.user!.id)} />)}
              </div>
            )}
          </section>
        </>
      )}
    </TabPage>
  );
}
