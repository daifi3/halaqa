import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import { PersonAvatar } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { colors, radius } from '@/theme';

export interface TileInfo {
  /** The participant's user id (their LiveKit identity). */
  key: string;
  name: string;
  avatarUrl?: string | null;
  isLocal: boolean;
  isTeacher: boolean;
  speaking: boolean;
  micOn: boolean;
  /** Rendered video element, or undefined when the camera is off. */
  video?: ReactNode;
}

export function ParticipantTile({ tile, compact, onMute, style }: {
  tile: TileInfo;
  compact?: boolean;
  /** Teacher only: shows a button that turns this student's microphone off. */
  onMute?: () => void;
  style?: CSSProperties;
}) {
  const avatar = compact ? 40 : 72;
  const btn = compact ? 24 : 32;
  return (
    <div
      className="a-zoom"
      style={{
        position: 'relative', backgroundColor: colors.stageCard, borderRadius: radius.lg, overflow: 'hidden',
        border: `2px solid ${tile.speaking ? colors.primary : 'transparent'}`, transition: 'border-color 200ms', minHeight: 0, ...style,
      }}
    >
      {tile.video ? (
        <div className="a-fade" style={{ position: 'absolute', inset: 0 }}>{tile.video}</div>
      ) : (
        <div className="v center" style={{ position: 'absolute', inset: 0 }}>
          {/* Soft breathing ring around the avatar while someone speaks. */}
          <span style={{
            position: 'absolute', width: avatar + 16, height: avatar + 16, borderRadius: '50%', backgroundColor: colors.primary,
            opacity: tile.speaking ? 0.5 : 0, transition: 'opacity 200ms', animation: tile.speaking ? 'breathe 900ms ease-in-out infinite' : undefined,
          }} />
          <span style={{ position: 'relative' }}>
            <PersonAvatar person={{ id: tile.key, name: tile.name, avatarUrl: tile.avatarUrl }} size={avatar} />
          </span>
        </div>
      )}

      <div className="h" style={{
        position: 'absolute', left: compact ? 4 : 8, bottom: compact ? 4 : 8, gap: 5, backgroundColor: 'rgba(0,0,0,0.5)',
        padding: compact ? '2px 6px' : '4px 9px', borderRadius: radius.pill, maxWidth: '90%',
      }}>
        {!tile.micOn && <Icon name="mic-off" size={compact ? 10 : 12} color={colors.danger} />}
        {tile.isTeacher && <Icon name="school" size={compact ? 10 : 12} color="#B9B5FF" />}
        <Text variant="small" color="#fff" lines={1} style={compact ? { fontSize: 10, lineHeight: '13px' } : undefined}>
          {tile.isLocal ? 'You' : tile.name}
        </Text>
      </div>

      {onMute && tile.micOn && (
        <Pressable
          scaleTo={0.85}
          onClick={onMute}
          aria-label={`Mute ${tile.name}`}
          title={`Mute ${tile.name}`}
          style={{
            position: 'absolute', top: compact ? 4 : 8, right: compact ? 4 : 8, width: btn, height: btn, borderRadius: btn / 2,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name="mic" size={compact ? 13 : 16} color="#fff" />
        </Pressable>
      )}
    </div>
  );
}
