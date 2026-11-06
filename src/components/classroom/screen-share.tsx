import Ionicons from '@expo/vector-icons/Ionicons';
import { Switch, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOut, LinearTransition } from 'react-native-reanimated';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import type { Peer } from '@/lib/screen-share';
import { colors, fonts, radius } from '@/theme';
import type { ActiveShare, StudentNotice } from './use-screen-share';

/* ---------- The shared screen itself ---------- */

/** Stand-in for a remote screen in mock mode, where there's no real video. */
function DemoScreen({ name }: { name: string }) {
  return (
    <View style={styles.demo}>
      <View style={styles.demoBar}>
        {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <View key={c} style={[styles.demoDot, { backgroundColor: c }]} />)}
        <Text variant="small" color="#5B5D66" style={{ marginLeft: 8 }} numberOfLines={1}>{name}’s screen · preview</Text>
      </View>
      <View style={{ padding: 18, gap: 10 }}>
        <View style={[styles.demoLine, { width: '62%', height: 14, backgroundColor: '#2B2D35' }]} />
        {[92, 84, 88, 70].map((w, i) => <View key={i} style={[styles.demoLine, { width: `${w}%` }]} />)}
        <View style={styles.demoChart}>
          {[40, 68, 52, 84, 60].map((h, i) => <View key={i} style={[styles.demoBarFill, { height: `${h}%` }]} />)}
        </View>
      </View>
    </View>
  );
}

export function ScreenView({ share, onStop }: {
  share: ActiveShare;
  /** Shown to the sharer, and to the teacher for a student's share. */
  onStop?: () => void;
}) {
  return (
    <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} style={styles.screen}>
      {share.isLocal ? (
        <View style={styles.localShare}>
          <View style={styles.localIcon}>
            <Ionicons name="desktop" size={28} color="#fff" />
          </View>
          <Text variant="heading" color={colors.stageText}>You’re sharing your screen</Text>
          <Text color={colors.stageMuted} style={{ textAlign: 'center', maxWidth: 280 }}>
            Everyone in class sees what’s on your screen, including notifications.
          </Text>
        </View>
      ) : share.video ? (
        <View style={StyleSheet.absoluteFill}>{share.video}</View>
      ) : (
        <DemoScreen name={share.name} />
      )}

      <View style={styles.screenBar}>
        <View style={styles.screenLabel}>
          <Ionicons name="desktop-outline" size={13} color={colors.stageText} />
          <Text variant="small" color={colors.stageText} numberOfLines={1}>{share.isLocal ? 'You' : share.name} · sharing</Text>
        </View>
        {onStop && (
          <PressableScale scaleTo={0.92} onPress={onStop} style={styles.stopBtn}>
            <Ionicons name="stop" size={12} color="#fff" />
            <Text variant="small" color="#fff">{share.isLocal ? 'Stop sharing' : 'Stop share'}</Text>
          </PressableScale>
        )}
      </View>
    </Animated.View>
  );
}

/* ---------- Teacher ---------- */

export function TeacherSharePanel({ sharing, policyOpen, studentShare, onToggleMine, onPolicy, onStopStudent }: {
  sharing: boolean;
  policyOpen: boolean;
  /** A student's share currently on screen, if any. */
  studentShare: ActiveShare | null;
  onToggleMine: () => void;
  onPolicy: (open: boolean) => void;
  onStopStudent: () => void;
}) {
  return (
    <Animated.View entering={FadeInUp.duration(180)} exiting={FadeOut.duration(120)} style={styles.panel}>
      <PressableScale scaleTo={0.97} onPress={onToggleMine} style={[styles.panelAction, sharing && { backgroundColor: colors.danger }]}>
        <Ionicons name={sharing ? 'stop-circle-outline' : 'desktop-outline'} size={18} color="#fff" />
        <Text variant="bodyStrong" color="#fff">{sharing ? 'Stop sharing my screen' : 'Share my screen'}</Text>
      </PressableScale>

      {studentShare && (
        <PressableScale scaleTo={0.97} onPress={onStopStudent} style={[styles.panelAction, styles.panelSecondary]}>
          <Ionicons name="close-circle-outline" size={18} color={colors.stageText} />
          <Text variant="bodyStrong" color={colors.stageText} numberOfLines={1}>Stop {studentShare.name}’s share</Text>
        </PressableScale>
      )}

      <View style={styles.policy}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" color={colors.stageText}>Students can share without asking</Text>
          <Text variant="small" color={colors.stageMuted}>When off, students send you a request first.</Text>
        </View>
        <Switch
          value={policyOpen}
          onValueChange={onPolicy}
          trackColor={{ false: colors.stageLine, true: colors.primary + '88' }}
          thumbColor={policyOpen ? colors.primary : '#fff'}
        />
      </View>
    </Animated.View>
  );
}

export function RequestCard({ peer, onAnswer }: { peer: Peer; onAnswer: (allow: boolean) => void }) {
  return (
    <Animated.View entering={FadeInUp.duration(220)} exiting={FadeOut.duration(150)} layout={LinearTransition} style={styles.request}>
      <View style={styles.requestIcon}>
        <Ionicons name="desktop-outline" size={16} color="#fff" />
      </View>
      <Text variant="small" color={colors.stageText} style={{ flex: 1 }}>
        <Text variant="small" color={colors.stageText} style={{ fontFamily: fonts.bold }}>{peer.name}</Text> wants to share their screen
      </Text>
      <PressableScale scaleTo={0.9} onPress={() => onAnswer(false)} style={[styles.answer, styles.decline]}>
        <Text variant="small" color={colors.stageText}>Decline</Text>
      </PressableScale>
      <PressableScale scaleTo={0.9} onPress={() => onAnswer(true)} style={[styles.answer, styles.allow]}>
        <Text variant="small" color="#fff">Allow</Text>
      </PressableScale>
    </Animated.View>
  );
}

/* ---------- Student ---------- */

const NOTICE: Record<Exclude<StudentNotice, null>, { icon: keyof typeof Ionicons.glyphMap; text: string; tint: string }> = {
  granted: { icon: 'checkmark-circle', text: 'Your teacher allowed you to share your screen', tint: colors.success },
  denied: { icon: 'close-circle', text: 'Your teacher declined your request to share', tint: colors.danger },
  revoked: { icon: 'stop-circle', text: 'Your teacher stopped your screen share', tint: colors.student },
};

export function StudentShareBanner({ pending, notice, onShare, onDismiss }: {
  pending: boolean;
  notice: StudentNotice;
  onShare: () => void;
  onDismiss: () => void;
}) {
  if (notice) {
    const n = NOTICE[notice];
    return (
      <Animated.View key={notice} entering={FadeInUp.duration(220)} exiting={FadeOut.duration(150)} style={styles.request}>
        <Ionicons name={n.icon} size={18} color={n.tint} />
        <Text variant="small" color={colors.stageText} style={{ flex: 1 }}>{n.text}</Text>
        {notice === 'granted' ? (
          <PressableScale scaleTo={0.9} onPress={onShare} style={[styles.answer, styles.allow]}>
            <Text variant="small" color="#fff">Share now</Text>
          </PressableScale>
        ) : (
          <PressableScale scaleTo={0.9} onPress={onDismiss} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.stageMuted} />
          </PressableScale>
        )}
      </Animated.View>
    );
  }
  if (!pending) return null;
  return (
    <Animated.View entering={FadeInUp.duration(220)} exiting={FadeOut.duration(150)} style={styles.request}>
      <Ionicons name="hourglass-outline" size={16} color={colors.stageMuted} />
      <Text variant="small" color={colors.stageMuted} style={{ flex: 1 }}>Waiting for your teacher to accept your screen share…</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000' },
  screenBar: { position: 'absolute', left: 10, right: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  screenLabel: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, flexShrink: 1, marginRight: 'auto',
  },
  stopBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.danger, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  localShare: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24, backgroundColor: colors.stageCard },
  localIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  demo: { flex: 1, backgroundColor: '#F4F2EE', margin: 0 },
  demoBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingTop: 48, paddingBottom: 10, backgroundColor: '#E2DED6' },
  demoDot: { width: 10, height: 10, borderRadius: 5 },
  demoLine: { height: 9, borderRadius: 5, backgroundColor: '#CFCAC0' },
  demoChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 120, marginTop: 12 },
  demoBarFill: { flex: 1, borderRadius: 6, backgroundColor: colors.primary },
  panel: {
    marginHorizontal: 12, marginBottom: 8, padding: 12, gap: 10, backgroundColor: colors.stageCard,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.stageLine,
  },
  panelAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: radius.md, backgroundColor: colors.primary },
  panelSecondary: { backgroundColor: colors.stageLine },
  policy: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  request: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, marginBottom: 8, padding: 10, paddingLeft: 12,
    backgroundColor: colors.stageCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.stageLine,
  },
  requestIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  answer: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  decline: { backgroundColor: colors.stageLine },
  allow: { backgroundColor: colors.success },
});
