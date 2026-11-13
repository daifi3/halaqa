import { Icon, type IconName } from '@/components/ui/icon';
import { delay, Spinner } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { colors, radius } from '@/theme';

/** Round control whose background glides between "off" and "on" colours. */
function Control({
  icon, iconOff, on, onPress, label, onColor = colors.stageCard, offColor = '#3A2427', busy, bare,
}: {
  icon: IconName; iconOff?: IconName; on: boolean; onPress: () => void; label: string;
  onColor?: string; offColor?: string; busy?: boolean;
  /** Desktop bar: no caption under the button, the label shows as a tooltip instead. */
  bare?: boolean;
}) {
  return (
    <div className="v" style={{ alignItems: 'center', gap: 6 }}>
      <Pressable
        onClick={onPress}
        scaleTo={0.86}
        disabled={busy}
        aria-label={label}
        title={bare ? label : undefined}
        aria-pressed={on}
        style={{
          width: 50, height: 50, borderRadius: 25, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: on ? onColor : offColor, transition: 'background-color 200ms, transform 260ms var(--spring)',
        }}
      >
        {busy ? <Spinner color="#fff" /> : <Icon name={on || !iconOff ? icon : iconOff} size={22} color={!on && iconOff ? '#FF8A8E' : '#fff'} />}
      </Pressable>
      {!bare && <Text variant="small" color={colors.stageMuted} style={{ fontSize: 11, lineHeight: '14px' }}>{label}</Text>}
    </div>
  );
}

export function ControlBar({
  mic, cam, board, recording, isTeacher, recordingBusy, canFlip, inline,
  onMic, onCam, onFlip, onBoard, onRecord, onLeave,
}: {
  /** Desktop: just the buttons in a row, for the full-width bottom bar. */
  inline?: boolean;
  mic: boolean; cam: boolean; board: boolean; recording: boolean; isTeacher: boolean; recordingBusy?: boolean;
  /** More than one camera to switch between. */
  canFlip: boolean;
  onMic: () => void; onCam: () => void; onFlip: () => void; onBoard: () => void; onRecord: () => void; onLeave: () => void;
}) {
  return (
    <div className="h a-down" style={inline ? { ...delay(150), gap: 12 } : {
      ...delay(150), justifyContent: 'space-around', alignItems: 'flex-start', backgroundColor: '#15161B', borderRadius: radius.xl,
      padding: '12px 6px', border: `1px solid ${colors.stageLine}`, maxWidth: 560, width: '100%', margin: '0 auto',
    }}>
      <Control bare={inline} icon="mic" iconOff="mic-off" on={mic} onPress={onMic} label={inline ? (mic ? 'Turn off microphone' : 'Turn on microphone') : 'Mic'} />
      <Control bare={inline} icon="videocam" iconOff="videocam-off" on={cam} onPress={onCam} label={inline ? (cam ? 'Turn off camera' : 'Turn on camera') : 'Camera'} />
      {canFlip && <Control bare={inline} icon="camera-reverse-outline" on onPress={onFlip} label={inline ? 'Switch camera' : 'Flip'} />}
      {/* The teacher opens the board for the whole class; students follow. */}
      {isTeacher && (
        <Control bare={inline} icon="easel" on={board} onPress={onBoard} label={inline ? (board ? 'Close the board' : 'Open the board') : 'Board'}
          onColor={colors.primary} offColor={colors.stageCard} />
      )}
      {isTeacher && (
        <Control
          bare={inline}
          icon={recording ? 'stop' : 'radio-button-on'}
          on={recording}
          onPress={onRecord}
          label={inline ? (recording ? 'Stop recording' : 'Record the class') : recording ? 'Stop' : 'Record'}
          onColor={colors.danger}
          offColor={colors.stageCard}
          busy={recordingBusy}
        />
      )}
      <div className="v" style={{ alignItems: 'center', gap: 6 }}>
        <Pressable onClick={onLeave} scaleTo={0.86} aria-label="Leave" title={inline ? 'Leave the class' : undefined}
          style={{
            width: inline ? 68 : 50, height: 50, borderRadius: 25, backgroundColor: colors.danger, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <Icon name="call" size={22} color="#fff" style={{ transform: 'rotate(135deg)' }} />
        </Pressable>
        {!inline && <Text variant="small" color={colors.stageMuted} style={{ fontSize: 11, lineHeight: '14px' }}>Leave</Text>}
      </div>
    </div>
  );
}
