import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing, FadeInUp, FadeOut, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming,
} from 'react-native-reanimated';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { REACTIONS, type Reaction, type ReactionEmoji } from '@/lib/reactions';
import { colors, radius } from '@/theme';

export const FLOAT_MS = 3000;

/** Stable 0..1 from the id, so each reaction gets its own lane and sway. */
const seed = (id: string) => ([...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 100) / 100;

function Floater({ reaction }: { reaction: Reaction }) {
  const s = seed(reaction.id);
  const rise = useSharedValue(0);
  const fade = useSharedValue(0);

  useEffect(() => {
    rise.set(withTiming(1, { duration: FLOAT_MS, easing: Easing.out(Easing.quad) }));
    fade.set(withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(FLOAT_MS - 900, withTiming(0, { duration: 700 })),
    ));
  }, [rise, fade]);

  const style = useAnimatedStyle(() => ({
    opacity: fade.get(),
    transform: [
      { translateY: -rise.get() * 320 },
      // A gentle side-to-side sway while it rises.
      { translateX: Math.sin(rise.get() * Math.PI * 2 + s * 6) * 14 },
      { scale: 0.6 + Math.min(rise.get() * 4, 1) * 0.5 },
    ],
  }));

  return (
    <Animated.View style={[styles.floater, { right: 12 + s * 70 }, style]}>
      <Text style={styles.floaterEmoji}>{reaction.emoji}</Text>
      <View style={[styles.floaterName, reaction.mine && { backgroundColor: colors.primary }]}>
        <Text variant="small" color="#fff" numberOfLines={1} style={styles.floaterNameText}>{reaction.mine ? 'You' : reaction.author}</Text>
      </View>
    </Animated.View>
  );
}

/** Reactions rising over the video, above the control bar. Never intercepts touches. */
export function FloatingReactions({ reactions, bottom }: { reactions: Reaction[]; bottom: number }) {
  return (
    <View style={[styles.layer, { bottom }]} pointerEvents="none">
      {reactions.map((r) => <Floater key={r.id} reaction={r} />)}
    </View>
  );
}

export function ReactionPicker({ onPick }: { onPick: (emoji: ReactionEmoji) => void }) {
  return (
    <Animated.View entering={FadeInUp.duration(180)} exiting={FadeOut.duration(120)} style={styles.picker}>
      {REACTIONS.map((emoji) => (
        <PressableScale key={emoji} scaleTo={0.75} onPress={() => onPick(emoji)} style={styles.pick} accessibilityLabel={`React ${emoji}`}>
          <Text style={styles.pickEmoji}>{emoji}</Text>
        </PressableScale>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', right: 0, width: 160, height: 360 },
  floater: { position: 'absolute', bottom: 0, alignItems: 'center', gap: 2 },
  floaterEmoji: { fontSize: 34, lineHeight: 42 },
  floaterName: { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, maxWidth: 110 },
  floaterNameText: { fontSize: 10, lineHeight: 13 },
  picker: {
    flexDirection: 'row', alignSelf: 'center', gap: 2, backgroundColor: colors.stageCard, borderRadius: radius.pill,
    padding: 6, borderWidth: 1, borderColor: colors.stageLine, marginBottom: 8,
  },
  pick: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  pickEmoji: { fontSize: 24, lineHeight: 30 },
});
