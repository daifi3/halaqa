import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { extractJoinCode } from '@/lib/join-link';
import { colors, radius } from '@/theme';

const LENGTH = 6;

function Cell({ char, active }: { char?: string; active: boolean }) {
  return (
    <View style={[styles.cell, active && styles.cellActive, char ? styles.cellFilled : null]}>
      <Text variant="title" color={colors.ink}>{char ?? ''}</Text>
    </View>
  );
}

export default function JoinCourse() {
  // Set when opened from a QR / deep link (halaqa://...join?code=XXXXXX) — joins straight away.
  const params = useLocalSearchParams<{ code?: string }>();
  const linked = (params.code ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, LENGTH);
  const autoJoin = linked.length === LENGTH;
  const [code, setCode] = useState(linked);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(autoJoin);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));

  function submit(value = code) {
    setLoading(true);
    join(value);
  }

  function onChangeCode(text: string) {
    setError(null);
    // A paste from the keyboard's clipboard bar can bring a whole link or message.
    const pasted = text.length > LENGTH ? extractJoinCode(text) : null;
    setCode(pasted ?? text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, LENGTH));
  }

  async function paste() {
    const text = await Clipboard.getStringAsync().catch(() => '');
    const pasted = extractJoinCode(text);
    if (!pasted) {
      setError(text.trim() ? 'No valid code found in what you copied' : 'Your clipboard is empty');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    setCode(pasted);
    setError(null);
    inputRef.current?.blur();
    submit(pasted);
  }

  async function join(value: string) {
    try {
      const course = await api.joinCourseByCode(value);
      if (router.canDismiss()) router.dismiss();
      router.push(`/course/${course.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      shake.set(withSequence(
        withTiming(-12, { duration: 50 }), withTiming(12, { duration: 50 }),
        withTiming(-8, { duration: 50 }), withTiming(8, { duration: 50 }), withSpring(0),
      ));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (autoJoin) join(linked);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for the link we were opened with
  }, []);

  return (
    <View style={styles.root}>
      <View style={{ gap: 6 }}>
        <Text variant="title">Join a course</Text>
        <Text color={colors.muted}>Enter the 6-character code your teacher shared.</Text>
      </View>

      <PressableScale haptic={false} scaleTo={1} onPress={() => inputRef.current?.focus()}>
        <Animated.View style={[styles.cells, shakeStyle]}>
          {Array.from({ length: LENGTH }, (_, i) => (
            <Cell key={i} char={code[i]} active={i === Math.min(code.length, LENGTH - 1)} />
          ))}
        </Animated.View>
      </PressableScale>
      <PressableScale onPress={paste} disabled={loading} style={styles.paste}>
        <Ionicons name="clipboard-outline" size={16} color={colors.student} />
        <Text variant="bodyStrong" color={colors.student}>Paste code</Text>
      </PressableScale>
      <TextInput
        ref={inputRef}
        value={code}
        autoFocus={!autoJoin}
        autoCapitalize="characters"
        autoCorrect={false}
        onChangeText={onChangeCode}
        onSubmitEditing={() => code.length === LENGTH && submit()}
        style={styles.hidden}
      />
      {error ? <Text variant="small" color={colors.danger}>{error}</Text> : <Text variant="small" color={colors.muted}>Demo code: ALGO9X</Text>}

      <Button title="Join course" icon="enter-outline" accent={colors.student} loading={loading} disabled={code.length < LENGTH} onPress={() => submit()} />
      <PressableScale onPress={() => { if (router.canDismiss()) router.dismiss(); router.push('/scan'); }} style={styles.scan}>
        <Ionicons name="qr-code-outline" size={18} color={colors.student} />
        <Text variant="bodyStrong" color={colors.student}>Scan a QR code instead</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, paddingTop: 32, gap: 20, backgroundColor: colors.bg },
  cells: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  cell: {
    flex: 1, height: 60, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5,
    borderColor: colors.line, alignItems: 'center', justifyContent: 'center',
  },
  cellActive: { borderColor: colors.student },
  cellFilled: { backgroundColor: colors.studentSoft, borderColor: colors.studentSoft },
  scan: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 6 },
  paste: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12,
    paddingVertical: 8, borderRadius: 999, backgroundColor: colors.studentSoft,
  },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
