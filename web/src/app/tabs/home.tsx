import { useNavigate } from 'react-router';
import { ActionCard, RoomCard } from '@/components/cards';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { PageHeader } from '@/components/ui/screen';
import { BellButton } from '@/components/inbox';
import { Avatar, delay, EmptyState, Skeleton } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/use-query';
import { useMe } from '@/store/session';
import { colors, radius } from '@/theme';
import { TabPage } from './tab-page';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function Stat({ value, label, icon, tint }: { value: string | number; label: string; icon: IconName; tint: string }) {
  return (
    <div className="h flex1 stat" style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 14 }}>
      <span className="h center desktop-only" style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: tint + '1F', flexShrink: 0 }}>
        <Icon name={icon} size={20} color={tint} />
      </span>
      <div className="v" style={{ gap: 2 }}>
        <Text variant="title">{value}</Text>
        <Text variant="small" color={colors.muted}>{label}</Text>
      </div>
    </div>
  );
}

/** "Dr. Amrani" → "Dr. Amrani", "Yasmine Bensalem" → "Yasmine": keep a title with the name after it. */
function firstName(name: string) {
  const [a = name, b] = name.split(' ');
  return a.endsWith('.') && b ? `${a} ${b}` : a;
}

export default function Home() {
  const user = useMe();
  const teacher = user.role === 'teacher';
  const navigate = useNavigate();
  const { data: rooms, loading, error } = useQuery(() => api.listRooms());

  const active = (rooms ?? []).filter((r) => r.status !== 'ended');
  const live = active.filter((r) => r.status === 'live');
  const upcoming = active.filter((r) => r.status === 'scheduled');

  return (
    <TabPage>
      <PageHeader
        title={
          <div className="v">
            <Text color={colors.muted}>{greeting()},</Text>
            <Text variant="title">{firstName(user.name)}</Text>
          </div>
        }
        actions={teacher ? (
          <>
            <Button size="md" variant="secondary" icon="library-outline" title="New course" onPress={() => navigate('/course/new')} />
            <Button size="md" icon="add" title="Reserve a room" onPress={() => navigate('/room/new')} />
          </>
        ) : (
          <>
            <Button size="md" variant="secondary" icon="library-outline" title="Join a course" onPress={() => navigate('/course/join')} />
            <Button size="md" icon="keypad" title="Join with a code" onPress={() => navigate('/join')} />
          </>
        )}
        aside={
          <div className="h mobile-only" style={{ gap: 10, alignSelf: 'center' }}>
            <BellButton />
            <Pressable onClick={() => navigate('/profile')} aria-label="Profile" style={{ borderRadius: '50%' }}>
              <Avatar name={user.name} size={46} ring={teacher ? colors.teacher : colors.student} uri={user.avatarUrl} />
            </Pressable>
          </div>
        }
      />

      <div className="mobile-only">
      <ActionCard
        tone={teacher ? colors.teacher : colors.student}
        icon={teacher ? 'add' : 'keypad'}
        title={teacher ? 'Reserve a room' : 'Join with a code'}
        body={teacher ? 'Schedule a class and invite students' : 'Enter the 6-letter code from your teacher'}
        onPress={() => navigate(teacher ? '/room/new' : '/join')}
      />
      </div>

      <div className="h a-down" style={{ ...delay(120), gap: 10, alignItems: 'stretch' }}>
        <Stat icon="radio-outline" tint={colors.danger} value={live.length} label="Live now" />
        <Stat icon="calendar-outline" tint={colors.primary} value={upcoming.length} label="Upcoming" />
        <Stat icon="time-outline" tint={colors.success} value={`${(active.reduce((m, r) => m + r.durationMin, 0) / 60) | 0}h`} label="Planned" />
      </div>

      {loading ? (
        <div className="cards-grid">
          <Skeleton height={190} />
          <Skeleton height={190} />
          <Skeleton height={190} />
        </div>
      ) : error ? (
        <EmptyState icon="cloud-offline-outline" title="Can't reach the server" body={error} />
      ) : active.length === 0 ? (
        <EmptyState
          icon={teacher ? 'calendar-outline' : 'mail-open-outline'}
          title={teacher ? 'No classes yet' : 'No invitations yet'}
          body={teacher ? 'Reserve your first room — it takes ten seconds.' : 'When a teacher invites you, the class appears here.'}
        />
      ) : (
        <div className="v" style={{ gap: 14 }}>
          <Text variant="label" color={colors.muted}>Your classes</Text>
          <div className="cards-grid">
            {[...live, ...upcoming].map((room, i) => (
              <RoomCard key={room.id} room={room} index={i} onPress={() => navigate(`/room/${room.id}`)} />
            ))}
          </div>
        </div>
      )}
    </TabPage>
  );
}
