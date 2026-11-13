import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { formatDay, formatTime } from '@/lib/format';
import type { Room } from '@/lib/types';
import { colors, radius, shadow } from '@/theme';
import { Chip, PersonAvatar, PulseDot } from './ui/misc';
import { PressableScale } from './ui/pressable-scale';
import { Text } from './ui/text';

export function RoomCard({ room, index, onPress }: { room: Room; index: number; onPress: () => void }) {
  const live = room.status === 'live';
  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 70)} layout={LinearTransition.springify()}>
      <PressableScale onPress={onPress} scaleTo={0.97} style={[styles.card, live && styles.cardLive]}>
        <View style={styles.top}>
          <View style={[styles.time, live && { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
            <Text variant="small" color={live ? '#fff' : colors.muted}>{formatDay(room.startsAt)}</Text>
            <Text variant="heading" color={live ? '#fff' : colors.ink}>{formatTime(room.startsAt)}</Text>
          </View>
          {live ? (
            <View style={styles.liveTag}>
              <PulseDot color="#FF6B6B" size={7} />
              <Text variant="label" color="#fff">Live now</Text>
            </View>
          ) : (
            <Chip label={`${room.durationMin} min`} icon="time-outline" />
          )}
        </View>

        <View style={{ gap: 4 }}>
          <Text variant="label" color={live ? 'rgba(255,255,255,0.65)' : colors.primary}>{room.subject}</Text>
          <Text variant="title" color={live ? '#fff' : colors.ink} numberOfLines={2}>{room.title}</Text>
        </View>

        <View style={styles.bottom}>
          <View style={styles.teacher}>
            <PersonAvatar person={room.teacher} size={28} />
            <Text variant="small" color={live ? 'rgba(255,255,255,0.8)' : colors.inkSoft}>{room.teacher.name}</Text>
          </View>
          <View style={[styles.go, live && { backgroundColor: '#fff' }]}>
            <Ionicons name="arrow-forward" size={18} color={live ? colors.ink : '#fff'} />
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 20, gap: 16, ...shadow.card },
  cardLive: { backgroundColor: colors.primary },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  time: { backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8 },
  liveTag: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.22)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill,
  },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  teacher: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  go: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
