import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip, EmptyState, Skeleton } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { formatDay, formatDuration } from '@/lib/format';
import type { Recording } from '@/lib/types';
import { useQuery } from '@/lib/use-query';
import { colors, radius, shadow } from '@/theme';

function RecordingRow({ rec, index }: { rec: Recording; index: number }) {
  const ready = rec.status === 'ready' && rec.url;
  return (
    <Animated.View entering={FadeInDown.delay(60 + index * 60)}>
      <PressableScale
        disabled={!ready}
        scaleTo={0.97}
        onPress={() => router.push({ pathname: '/recording/[id]', params: { id: rec.id, url: rec.url!, title: rec.roomTitle } })}
        style={styles.row}
      >
        <View style={[styles.thumb, !ready && { backgroundColor: colors.surfaceAlt }]}>
          {ready ? <Ionicons name="play" size={22} color="#fff" /> : <ActivityIndicator color={colors.muted} />}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="bodyStrong" numberOfLines={1}>{rec.roomTitle}</Text>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Text variant="small" color={colors.muted}>{formatDay(rec.recordedAt)}</Text>
            <Text variant="small" color={colors.line}>•</Text>
            <Text variant="small" color={colors.muted}>{rec.subject}</Text>
          </View>
        </View>
        {ready ? (
          <Chip label={formatDuration(rec.durationSec)} />
        ) : (
          <Chip label="Processing" color={colors.student} bg={colors.studentSoft} />
        )}
      </PressableScale>
    </Animated.View>
  );
}

export default function Recordings() {
  const { data, loading, refreshing, refresh, error } = useQuery(() => api.listRecordings());

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <Animated.View entering={FadeInUp.duration(400)} style={{ gap: 4 }}>
          <Text variant="title">Recordings</Text>
          <Text color={colors.muted}>Every recorded lesson, ready to replay.</Text>
        </Animated.View>

        {loading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} height={76} />)
        ) : error ? (
          <EmptyState icon="cloud-offline-outline" title="Can't load recordings" body={error} />
        ) : !data?.length ? (
          <EmptyState icon="videocam-outline" title="Nothing recorded yet" body="When a teacher records a class, it will show up here." />
        ) : (
          data.map((rec, i) => <RecordingRow key={rec.id} rec={rec} index={i} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12, paddingBottom: 140 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: 12, ...shadow.card,
  },
  thumb: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
