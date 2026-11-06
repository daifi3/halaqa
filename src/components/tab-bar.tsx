import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, springs } from '@/theme';
import { PressableScale } from './ui/pressable-scale';

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  index: ['grid', 'grid-outline'],
  courses: ['library', 'library-outline'],
  exams: ['ribbon', 'ribbon-outline'],
  recordings: ['play-circle', 'play-circle-outline'],
  profile: ['person-circle', 'person-circle-outline'],
};

/** Floating pill tab bar with an indicator that springs between tabs. */
export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const tabW = width / state.routes.length;

  const indicator = useAnimatedStyle(() => ({
    width: tabW - 8,
    transform: [{ translateX: withSpring(state.index * tabW + 4, springs.gentle) }],
  }));

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <View style={styles.bar} onLayout={(e) => setWidth(e.nativeEvent.layout.width - 12)}>
        {width > 0 && <Animated.View style={[styles.indicator, indicator]} />}
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const [on, off] = ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];
          return (
            <PressableScale
              key={route.key}
              scaleTo={0.9}
              style={styles.tab}
              onPress={() => {
                if (!focused) navigateToTab(route.key);
              }}
            >
              <Ionicons name={focused ? on : off} size={20} color={focused ? '#fff' : colors.muted} />
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 6,
    width: '86%', ...shadow.float,
  },
  indicator: { position: 'absolute', top: 6, bottom: 6, left: 2, borderRadius: radius.pill, backgroundColor: colors.ink },
  tab: { flex: 1, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
