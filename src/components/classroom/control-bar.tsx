import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, interpolateColor, useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, radius } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** Round control whose background glides between "off" and "on" colours. */
function Control({
  icon, iconOff, on, onPress, label, onColor = colors.stageCard, offColor = '#3A2427', busy,
}: {
  icon: IconName; iconOff?: IconName; on: boolean; onPress: () => void; label: string;
  onColor?: string; offColor?: string; busy?: boolean;
}) {
  const p = useDerivedValue(() => withTiming(on ? 1 : 0, { duration: 200 }));
  const bg = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.value, [0, 1], [offColor, onColor]) }));
  return (
    <View style={styles.item}>
      <PressableScale onPress={onPress} scaleTo={0.86} disabled={busy}>
        <Animated.View style={[styles.btn, bg]}>
          {busy ? <ActivityIndicator color="#fff" size="small" /> : (
            <Ionicons name={on || !iconOff ? icon : iconOff} size={22} color={!on && iconOff ? '#FF8A8E' : '#fff'} />
          )}
        </Animated.View>
      </PressableScale>
      <Text variant="small" color={colors.stageMuted} style={styles.caption}>{label}</Text>
    </View>
  );
}

export function ControlBar({
  mic, cam, board, recording, isTeacher, recordingBusy,
  onMic, onCam, onFlip, onBoard, onRecord, onLeave,
}: {
  mic: boolean; cam: boolean; board: boolean; recording: boolean; isTeacher: boolean; recordingBusy?: boolean;
  onMic: () => void; onCam: () => void; onFlip: () => void; onBoard: () => void; onRecord: () => void; onLeave: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(150)} style={styles.bar}>
      <Control icon="mic" iconOff="mic-off" on={mic} onPress={onMic} label="Mic" />
      <Control icon="videocam" iconOff="videocam-off" on={cam} onPress={onCam} label="Camera" />
      <Control icon="camera-reverse-outline" on onPress={onFlip} label="Flip" />
      {/* The teacher opens the board for the whole class; students follow. */}
      {isTeacher && (
        <Control
          icon="easel"
          on={board}
          onPress={onBoard}
          label="Board"
          onColor={colors.primary}
          offColor={colors.stageCard}
        />
      )}
      {isTeacher && (
        <Control
          icon={recording ? 'stop' : 'radio-button-on'}
          on={recording}
          onPress={onRecord}
          label={recording ? 'Stop' : 'Record'}
          onColor={colors.danger}
          offColor={colors.stageCard}
          busy={recordingBusy}
        />
      )}
      <View style={styles.item}>
        <PressableScale onPress={onLeave} scaleTo={0.86} style={[styles.btn, styles.leave]}>
          <Ionicons name="call" size={22} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        </PressableScale>
        <Text variant="small" color={colors.stageMuted} style={styles.caption}>Leave</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start',
    backgroundColor: '#15161B', borderRadius: radius.xl, paddingVertical: 12, paddingHorizontal: 6,
    borderWidth: 1, borderColor: colors.stageLine,
  },
  item: { alignItems: 'center', gap: 6 },
  btn: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  leave: { backgroundColor: colors.danger },
  caption: { fontSize: 11, lineHeight: 14 },
});
