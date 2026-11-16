import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';
import { colors, fonts, isDark, radius } from '@/theme';
import { Text } from './text';

/** Text field with a label and a border that glides to the accent colour on focus. */
export function Input({
  label,
  icon,
  accent = colors.primary,
  error,
  style,
  ...rest
}: TextInputProps & { label?: string; icon?: keyof typeof Ionicons.glyphMap; accent?: string; error?: string | null }) {
  const [focused, setFocused] = useState(false);
  const isPassword = !!rest.secureTextEntry;
  const [revealed, setRevealed] = useState(false);
  const progress = useDerivedValue(() => withTiming(focused ? 1 : 0, { duration: 180 }));
  const borderStyle = useAnimatedStyle(() => ({
    borderColor: error ? colors.danger : interpolateColor(progress.value, [0, 1], [colors.line, accent]),
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.surface, colors.surface]),
  }));

  return (
    <View style={{ gap: 8 }}>
      {label && <Text variant="label" color={colors.muted}>{label}</Text>}
      <Animated.View style={[styles.field, borderStyle]}>
        {icon && <Ionicons name={icon} size={18} color={focused ? accent : colors.muted} />}
        <TextInput
          placeholderTextColor={colors.muted}
          keyboardAppearance={isDark ? 'dark' : 'light'}
          selectionColor={accent}
          {...rest}
          secureTextEntry={isPassword && !revealed}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          style={[styles.input, style]}
        />
        {isPassword && (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          >
            <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={20} color={focused ? accent : colors.muted} />
          </Pressable>
        )}
      </Animated.View>
      {error ? <Text variant="small" color={colors.danger}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 54, borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.ink, paddingVertical: 14 },
});
