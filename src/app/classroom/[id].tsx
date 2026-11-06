import { LiveKitRoom } from '@livekit/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { DemoStage } from '@/components/classroom/demo-stage';
import { LiveStage } from '@/components/classroom/live-stage';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { config } from '@/lib/config';
import type { JoinCredentials, Room } from '@/lib/types';
import { useSession } from '@/store/session';
import { colors } from '@/theme';

export default function Classroom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isTeacher = useSession((s) => s.user?.role === 'teacher');
  const [room, setRoom] = useState<Room | null>(null);
  const [creds, setCreds] = useState<JoinCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([api.getRoom(id), api.getJoinCredentials(id)])
      .then(([r, c]) => { if (alive) { setRoom(r); setCreds(c); } })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Could not join the class'));
    return () => { alive = false; };
  }, [id]);

  async function leave(endForAll: boolean) {
    if (endForAll && room) await api.endRoom(room.id).catch(() => {});
    router.back();
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text variant="heading" color={colors.stageText}>Couldn&apos;t join</Text>
        <Text color={colors.stageMuted} style={{ textAlign: 'center' }}>{error}</Text>
        <Button title="Go back" variant="secondary" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  if (!room || !creds) {
    return (
      <Animated.View entering={FadeIn} style={styles.center}>
        <ActivityIndicator color="#fff" />
        <Text color={colors.stageMuted}>Preparing your classroom…</Text>
      </Animated.View>
    );
  }

  if (config.useMock) return <DemoStage room={room} isTeacher={isTeacher} onLeave={leave} />;

  return (
    <LiveKitRoom
      serverUrl={creds.serverUrl}
      token={creds.token}
      connect
      audio
      video
      options={{ adaptiveStream: { pixelDensity: 'screen' }, dynacast: true }}
      onError={(e) => setError(e.message)}
    >
      <LiveStage room={room} isTeacher={isTeacher} onLeave={leave} />
    </LiveKitRoom>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32, backgroundColor: colors.stage },
});
