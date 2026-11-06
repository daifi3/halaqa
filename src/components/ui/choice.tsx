import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';
import { colors, radius } from '@/theme';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

function ChoicePill({ label, sub, selected, onPress, accent }: {
  label: string; sub?: string; selected: boolean; onPress: () => void; accent: string;
}) {
  const p = useDerivedValue(() => withTiming(selected ? 1 : 0, { duration: 180 }));
  const s = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [colors.surface, accent]),
    borderColor: interpolateColor(p.value, [0, 1], [colors.line, accent]),
  }));
  return (
    <PressableScale onPress={onPress} scaleTo={0.92}>
      <Animated.View style={[styles.pill, sub ? styles.pillTall : null, s]}>
        {sub && <Text variant="small" color={selected ? 'rgba(255,255,255,0.75)' : colors.muted}>{sub}</Text>}
        <Text variant="bodyStrong" color={selected ? '#fff' : colors.ink}>{label}</Text>
      </Animated.View>
    </PressableScale>
  );
}

/** Horizontal (or wrapping) row of selectable pills. */
export function ChoiceRow<T extends string | number>({
  options, value, onChange, accent = colors.primary, wrap,
}: {
  options: { value: T; label: string; sub?: string }[];
  value: T;
  onChange: (v: T) => void;
  accent?: string;
  wrap?: boolean;
}) {
  const items = options.map((o) => (
    <ChoicePill key={String(o.value)} label={o.label} sub={o.sub} selected={o.value === value} onPress={() => onChange(o.value)} accent={accent} />
  ));
  if (wrap) return <View style={styles.wrap}>{items}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={{ marginHorizontal: -20 }}>
      {items}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: 20 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center' },
  pillTall: { paddingVertical: 10, minWidth: 64 },
});
