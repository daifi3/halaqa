import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { DemoStage } from '@/components/classroom/demo-stage';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import type { Room } from '@/lib/types';
import { useSession } from '@/store/session';
import { colors } from '@/theme';

// Web build of the classroom route (Metro picks this over `[id].tsx` on web).
// LiveKit's React Native SDK (@livekit/react-native-webrtc) has no web
// implementation — it calls requireNativeComponent() at import time, which
// crashes under react-native-web. Real video calling on web would need the
// browser `livekit-client` / `@livekit/components-react` SDK wired up as its
// own implementation, which isn't done yet. Until then, web always shows the
// same demo/preview experience native uses for `config.useMock`, so this file
// never imports `@livekit/react-native` or `LiveKitRoom`.
export default function ClassroomWeb() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isTeacher = useSession((s) => s.user?.role === 'teacher');
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.getRoom(id)
      .then((r) => { if (alive) setRoom(r); })
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

  if (!room) {
    return (
      <Animated.View entering={FadeIn} style={styles.center}>
        <ActivityIndicator color="#fff" />
        <Text color={colors.stageMuted}>Preparing your classroom…</Text>
      </Animated.View>
    );
  }

  return <DemoStage room={room} isTeacher={isTeacher} onLeave={leave} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32, backgroundColor: colors.stage },
});
