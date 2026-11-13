import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { initials } from '@/lib/format';
import type { Person } from '@/lib/types';
import { useSession } from '@/store/session';
import { colors, radius } from '@/theme';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

/* ---------- Avatar ---------- */

const AVATAR_TONES = ['#4B44E0', '#E0763C', '#1F9D6B', '#C2417E', '#2F80C2', '#8A5CF6'];
const toneFor = (name: string) => AVATAR_TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length]!;

export function Avatar({ name, size = 40, ring, uri }: { name: string; size?: number; ring?: string; uri?: string | null }) {
  const tone = toneFor(name);
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2, backgroundColor: tone + '22',
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        borderWidth: ring ? 2 : 0, borderColor: ring,
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} />
      ) : (
        <Text style={{ fontSize: size * 0.38, lineHeight: size * 0.48 }} variant="bodyStrong" color={tone}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

/**
 * Avatar for a person from server data. When it's the signed-in user, their name
 * and picture come from the session instead, so a new profile picture shows up on
 * every screen at once, without waiting for the next fetch.
 */
export function PersonAvatar({ person, size, ring }: { person: Person; size?: number; ring?: string }) {
  const me = useSession((s) => (s.user && s.user.id === person.id ? s.user : null));
  const shown = me ?? person;
  return <Avatar name={shown.name} size={size} ring={ring} uri={shown.avatarUrl} />;
}

/* ---------- Chip ---------- */

export function Chip({ label, color = colors.inkSoft, bg = colors.surfaceAlt, icon }: {
  label: string; color?: string; bg?: string; icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      {icon && <Ionicons name={icon} size={12} color={color} />}
      <Text variant="small" color={color} style={{ fontSize: 12 }}>{label}</Text>
    </View>
  );
}

/* ---------- Pulsing live dot ---------- */

export function PulseDot({ color = colors.danger, size = 8 }: { color?: string; size?: number }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.set(withRepeat(withTiming(2.4, { duration: 1100, easing: Easing.out(Easing.quad) }), -1, false));
  }, [s]);
  const halo = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: 1.6 - s.value * 0.66 }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size, backgroundColor: color }, halo]} />
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

/* ---------- Icon button ---------- */

export function IconButton({
  icon, onPress, color = colors.ink, bg = colors.surface, size = 44, style,
}: {
  icon: keyof typeof Ionicons.glyphMap; onPress?: () => void; color?: string; bg?: string; size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.9}
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Ionicons name={icon} size={size * 0.45} color={color} />
    </PressableScale>
  );
}

/* ---------- Skeleton (shimmer placeholder) ---------- */

export function Skeleton({ height = 96, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const o = useSharedValue(0.5);
  useEffect(() => {
    o.set(withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0.5, { duration: 700 })), -1));
  }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ height, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt }, a, style]} />;
}

/* ---------- Toggle row (icon + label + switch) ---------- */

export function ToggleRow({
  icon, title, body, value, onChange, disabled, tint = colors.primary,
}: {
  icon: keyof typeof Ionicons.glyphMap; title: string; body: string; value: boolean; onChange: (v: boolean) => void;
  disabled?: boolean; tint?: string;
}) {
  return (
    <View style={[styles.toggleRow, disabled && { opacity: 0.4 }]}>
      <View style={[styles.toggleIcon, { backgroundColor: tint + '22' }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="small" color={colors.muted}>{body}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.line, true: tint + '55' }}
        thumbColor={value && !disabled ? tint : '#fff'}
      />
    </View>
  );
}

/* ---------- Empty state ---------- */

export function EmptyState({ icon, title, body, children }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; body: string; children?: React.ReactNode;
}) {
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <Text variant="heading" style={{ textAlign: 'center' }}>{title}</Text>
      <Text color={colors.muted} style={{ textAlign: 'center', maxWidth: 280 }}>{body}</Text>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  toggleIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 24 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 22, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
});
