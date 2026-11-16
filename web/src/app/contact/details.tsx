import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Avatar, EmptyState, IconButton, Skeleton } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { describeCall, isMissed, otherParty } from '@/lib/calls';
import { alert } from '@/lib/dialog';
import { formatDay, formatTime } from '@/lib/format';
import { useBack } from '@/lib/navigation';
import { useOpenChat } from '@/components/chat/chat-widget';
import { useStartCall } from '@/lib/use-calls';
import { useQuery } from '@/lib/use-query';
import { colors, radius } from '@/theme';

function Action({ icon, label, tint, onPress, href, disabled }: {
  icon: IconName; label: string; tint: string; onPress?: () => void; href?: string; disabled?: boolean;
}) {
  const circle = (
    <span className="h center" style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: tint }}>
      <Icon name={icon} size={20} color="#fff" />
    </span>
  );
  const style = { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 6, opacity: disabled ? 0.4 : 1, background: 'transparent' };
  if (href && !disabled) {
    return <a href={href} className="press" style={style}>{circle}<Text variant="small" color={colors.inkSoft}>{label}</Text></a>;
  }
  return (
    <Pressable hover={false} scaleTo={0.94} onClick={onPress} disabled={disabled} style={style}>
      {circle}
      <Text variant="small" color={colors.inkSoft}>{label}</Text>
    </Pressable>
  );
}

function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="h" style={{ gap: 12, padding: '14px 0' }}>
      <Icon name={icon} size={18} color={colors.muted} />
      <div className="v flex1" style={{ gap: 2 }}>
        <Text variant="label" color={colors.muted}>{label}</Text>
        <Text className="pre" style={{ userSelect: 'text' }}>{value}</Text>
      </div>
    </div>
  );
}

export default function ContactDetails() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const back = useBack('/contacts');
  const startCall = useStartCall();
  const openChat = useOpenChat();
  const { data, loading, error } = useQuery(() => Promise.all([api.getContact(id), api.listCalls()]), [id]);
  const [contact, calls] = data ?? [null, []];
  const history = contact?.user ? calls.filter((c) => otherParty(c).id === contact.user!.id).slice(0, 10) : [];

  function remove() {
    if (!contact) return;
    alert(`Delete ${contact.name}?`, 'This only removes them from your contacts.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => { api.deleteContact(contact.id).then(back).catch((e) => alert('Couldn’t delete', e instanceof Error ? e.message : 'Please try again.')); },
      },
    ]);
  }

  return (
    <Screen narrow right={contact && <IconButton icon="create-outline" label="Edit contact" onPress={() => navigate(`/contact/edit?id=${contact.id}`)} />}>
      {loading ? (
        <Skeleton height={220} />
      ) : error || !contact ? (
        <EmptyState icon="person-outline" title="Contact not found" body={error ?? 'It may have been deleted.'} />
      ) : (
        <div className="v" style={{ gap: 24, paddingBottom: 60 }}>
          <div className="v a-zoom" style={{ alignItems: 'center', gap: 10 }}>
            <Avatar name={contact.name} size={92} uri={contact.user?.avatarUrl} />
            <Text variant="title" style={{ textAlign: 'center' }}>{contact.name}</Text>
            <Text variant="small" color={contact.user ? colors.success : colors.muted}>
              {contact.user ? 'On Halaqa · free audio calls' : 'No Halaqa account for this email'}
            </Text>
          </div>

          <div className="h a-down" style={{ justifyContent: 'center', gap: 20 }}>
            <Action icon="chatbubble-ellipses" label="Message" tint={colors.primary} disabled={!contact.user} onPress={() => void openChat(contact.user!.id)} />
            <Action icon="call" label="Call" tint={colors.success} disabled={!contact.user} onPress={() => startCall(contact.user!)} />
            <Action icon="phone-portrait-outline" label="Phone" tint={colors.inkSoft} disabled={!contact.phone}
              href={contact.phone ? `tel:${contact.phone.replace(/[^\d+]/g, '')}` : undefined} />
            <Action icon="mail" label="Email" tint={colors.student} disabled={!contact.email}
              href={contact.email ? `mailto:${contact.email}` : undefined} />
          </div>

          {(contact.email || contact.phone || contact.note) && (
            <div className="a-down" style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: '0 16px', boxShadow: 'var(--shadow-card)' }}>
              {contact.email && <InfoRow icon="mail-outline" label="Email" value={contact.email} />}
              {contact.phone && <InfoRow icon="call-outline" label="Phone" value={contact.phone} />}
              {contact.note && <InfoRow icon="document-text-outline" label="Note" value={contact.note} />}
            </div>
          )}

          {history.length > 0 && (
            <section className="v a-down" style={{ gap: 10 }}>
              <Text variant="label" color={colors.muted}>Calls</Text>
              <div style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: '0 16px', boxShadow: 'var(--shadow-card)' }}>
                {history.map((c) => (
                  <div key={c.id} className="h" style={{ gap: 12, padding: '14px 0' }}>
                    <Icon name={isMissed(c) ? 'call' : c.outgoing ? 'arrow-up' : 'arrow-down'} size={16} color={isMissed(c) ? colors.danger : colors.muted} />
                    <Text className="flex1" color={isMissed(c) ? colors.danger : colors.ink}>{describeCall(c)}</Text>
                    <Text variant="small" color={colors.muted}>{formatDay(c.createdAt)}, {formatTime(c.createdAt)}</Text>
                  </div>
                ))}
              </div>
            </section>
          )}

          <Button title="Delete contact" variant="ghost" icon="trash-outline" onPress={remove} />
        </div>
      )}
    </Screen>
  );
}
