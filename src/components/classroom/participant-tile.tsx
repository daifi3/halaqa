import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, ZoomIn,
} from 'react-native-reanimated';
import { PersonAvatar } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, radius } from '@/theme';

export interface TileInfo {
  /** The participant's user id (their LiveKit identity). */
  key: string;
  name: string;
  avatarUrl?: string | null;
  isLocal: boolean;
  isTeacher: boolean;
  speaking: boolean;
  micOn: boolean;
  /** Rendered video element, or undefined when the camera is off. */
  video?: React.ReactNode;
}

/** Soft breathing ring around the avatar while someone speaks. */
function SpeakingRing({ active, size }: { active: boolean; size: number }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.set(active
      ? withRepeat(withSequence(withTiming(1.18, { duration: 450 }), withTiming(1.04, { duration: 450 })), -1)
      : withTiming(1, { duration: 200 }));
  }, [active, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: active ? 0.5 : 0 }));
  return <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary }, style]} />;
}

export function ParticipantTile({ tile, compact, onMute, style }: {
  tile: TileInfo;
  compact?: boolean;
  /** Teacher only: shows a button that turns this student's microphone off. */
  onMute?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const avatar = compact ? 40 : 72;
  const btn = compact ? 24 : 32;
  return (
    <Animated.View
      entering={ZoomIn}
      style={[styles.tile, tile.speaking && styles.speaking, style]}
    >
      {tile.video ? (
        <Animated.View entering={FadeIn} style={StyleSheet.absoluteFill}>{tile.video}</Animated.View>
      ) : (
        <View style={styles.center}>
          <SpeakingRing active={tile.speaking} size={avatar + 16} />
          <PersonAvatar person={{ id: tile.key, name: tile.name, avatarUrl: tile.avatarUrl }} size={avatar} />
        </View>
      )}

      <View style={[styles.label, compact && styles.labelCompact]}>
        {!tile.micOn && <Ionicons name="mic-off" size={compact ? 10 : 12} color={colors.danger} />}
        {tile.isTeacher && <Ionicons name="school" size={compact ? 10 : 12} color="#B9B5FF" />}
        <Text variant="small" color="#fff" numberOfLines={1} style={compact ? { fontSize: 10, lineHeight: 13 } : undefined}>
          {tile.isLocal ? 'You' : tile.name}
        </Text>
      </View>

      {onMute && tile.micOn && (
        <PressableScale
          scaleTo={0.85}
          onPress={onMute}
          accessibilityLabel={`Mute ${tile.name}`}
          hitSlop={8}
          style={[styles.mute, compact && styles.muteCompact, { width: btn, height: btn, borderRadius: btn / 2 }]}
        >
          <Ionicons name="mic" size={compact ? 13 : 16} color="#fff" />
        </PressableScale>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.stageCard, borderRadius: radius.lg, overflow: 'hidden',
    borderWidth: 2, borderColor: 'transparent',
  },
  speaking: { borderColor: colors.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: {
    position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, maxWidth: '90%',
  },
  labelCompact: { left: 4, bottom: 4, paddingHorizontal: 6, paddingVertical: 2 },
  mute: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  muteCompact: { top: 4, right: 4 },
});
