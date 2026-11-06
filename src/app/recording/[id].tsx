import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconButton } from '@/components/ui/misc';
import { Text } from '@/components/ui/text';

export default function RecordingPlayer() {
  const { url, title } = useLocalSearchParams<{ id: string; url: string; title: string }>();
  const player = useVideoPlayer(url, (p) => {
    p.play();
  });

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Animated.View entering={FadeInDown} style={styles.header}>
        <IconButton icon="chevron-down" onPress={() => router.back()} bg="rgba(255,255,255,0.12)" color="#fff" />
        <View style={{ flex: 1 }}>
          <Text variant="label" color="rgba(255,255,255,0.5)">Recording</Text>
          <Text variant="heading" color="#fff" numberOfLines={1}>{title}</Text>
        </View>
      </Animated.View>
      <Animated.View entering={FadeIn.delay(150).duration(400)} style={styles.videoWrap}>
        <VideoView player={player} style={styles.video} nativeControls fullscreenOptions={{ enable: true }} allowsPictureInPicture contentFit="contain" />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  videoWrap: { flex: 1, justifyContent: 'center' },
  video: { width: '100%', aspectRatio: 16 / 9 },
});
