import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing, FadeIn, FadeInDown, FadeInUp, interpolateColor, useAnimatedStyle, useDerivedValue,
  useSharedValue, withRepeat, withSpring, withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import type { Role } from '@/lib/types';
import { colors, radius, springs } from '@/theme';

/** Three soft shapes drifting slowly — gives the first screen some life. */
function FloatingHero() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [t]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: -10 + t.value * 20 }, { rotate: `${-8 + t.value * 16}deg` }] }));
  const b = useAnimatedStyle(() => ({ transform: [{ translateX: 12 - t.value * 24 }, { scale: 0.95 + t.value * 0.1 }] }));
  const c = useAnimatedStyle(() => ({ transform: [{ translateY: 8 - t.value * 16 }, { rotate: `${10 - t.value * 20}deg` }] }));

  return (
    <View style={styles.hero}>
      <Animated.View style={[styles.blobA, a]} />
      <Animated.View style={[styles.blobB, b]} />
      <Animated.View style={[styles.blobC, c]} />
      <Animated.View entering={FadeIn.delay(200).duration(600)} style={styles.heroBoard}>
        <View style={styles.heroScreen}>
          <Ionicons name="easel-outline" size={44} color={colors.primary} />
        </View>
        <View style={styles.heroRow}>
          {[colors.teacher, colors.student, colors.success].map((c) => (
            <View key={c} style={[styles.heroDot, { backgroundColor: c + '33', borderColor: c }]} />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

function RoleCard({ role, selected, onPress, delay }: { role: Role; selected: boolean; onPress: () => void; delay: number }) {
  const tone = role === 'teacher' ? colors.teacher : colors.student;
  const soft = role === 'teacher' ? colors.teacherSoft : colors.studentSoft;
  const p = useDerivedValue(() => withSpring(selected ? 1 : 0, springs.gentle));
  const card = useAnimatedStyle(() => ({
    borderColor: interpolateColor(p.value, [0, 1], [colors.line, tone]),
    transform: [{ translateY: -4 * p.value }],
  }));
  const check = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: 0.4 + 0.6 * p.value }] }));

  return (
    <Animated.View entering={FadeInDown.delay(delay)} style={{ flex: 1 }}>
      <PressableScale onPress={onPress} scaleTo={0.95}>
        <Animated.View style={[styles.role, card]}>
          <View style={[styles.roleIcon, { backgroundColor: soft }]}>
            <Ionicons name={role === 'teacher' ? 'school' : 'book'} size={22} color={tone} />
          </View>
          <Text variant="heading">{role === 'teacher' ? 'I teach' : 'I learn'}</Text>
          <Text variant="small" color={colors.muted}>
            {role === 'teacher' ? 'Reserve rooms, invite students, record lessons.' : 'Join classes, follow the board, replay lessons.'}
          </Text>
          <Animated.View style={[styles.check, { backgroundColor: tone }, check]}>
            <Ionicons name="checkmark" size={14} color="#fff" />
          </Animated.View>
        </Animated.View>
      </PressableScale>
    </Animated.View>
  );
}

export default function Welcome() {
  const [role, setRole] = useState<Role | null>(null);
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <FloatingHero />
      <View style={styles.body}>
        <Animated.View entering={FadeInUp.delay(100).duration(500)} style={{ gap: 10 }}>
          <Text variant="label" color={colors.primary}>Halaqa</Text>
          <Text variant="display">Classrooms that{'\n'}feel close.</Text>
          <Text color={colors.muted}>Live video, a shared whiteboard and recorded lessons — in one calm place.</Text>
        </Animated.View>

        <View style={styles.roles}>
          <RoleCard role="teacher" selected={role === 'teacher'} onPress={() => setRole('teacher')} delay={250} />
          <RoleCard role="student" selected={role === 'student'} onPress={() => setRole('student')} delay={330} />
        </View>

        <Animated.View entering={FadeInUp.delay(450)} style={{ gap: 16 }}>
          <Button
            title="Continue"
            icon="arrow-forward"
            disabled={!role}
            accent={role === 'student' ? colors.student : role === 'teacher' ? colors.teacher : undefined}
            onPress={() => role && router.push({ pathname: '/sign-up', params: { role } })}
          />
          <PressableScale onPress={() => router.push('/log-in')} style={{ alignSelf: 'center' }}>
            <Text color={colors.muted}>Already have an account? <Text color={colors.primary} variant="bodyStrong">Log in</Text></Text>
          </PressableScale>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hero: { height: 260, alignItems: 'center', justifyContent: 'center' },
  blobA: { position: 'absolute', width: 170, height: 170, borderRadius: 60, backgroundColor: colors.teacherSoft, left: 36, top: 30 },
  blobB: { position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: colors.studentSoft, right: 40, top: 70 },
  blobC: { position: 'absolute', width: 80, height: 80, borderRadius: 24, backgroundColor: colors.successSoft, left: 120, bottom: 10 },
  heroBoard: { width: 190, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, gap: 10 },
  heroScreen: { height: 100, borderRadius: radius.md, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  heroRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  heroDot: { width: 34, height: 34, borderRadius: 17, borderWidth: 2 },
  body: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between', paddingBottom: 12 },
  roles: { flexDirection: 'row', gap: 12 },
  role: {
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 2, padding: 16, gap: 8, minHeight: 170,
  },
  roleIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  check: { position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
