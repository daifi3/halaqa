import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { REACTIONS, type Reaction, type ReactionEmoji } from '@/lib/reactions';
import { colors, radius } from '@/theme';

export const FLOAT_MS = 3000;

/** Stable 0..1 from the id, so each reaction gets its own lane and sway. */
const seed = (id: string) => ([...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 100) / 100;

function Floater({ reaction }: { reaction: Reaction }) {
  const s = seed(reaction.id);
  return (
    <div className="floater" style={{ right: 12 + s * 70, ['--sway' as string]: `${(s - 0.5) * 28}px` }}>
      <span style={{ fontSize: 34, lineHeight: '42px' }}>{reaction.emoji}</span>
      <span style={{ backgroundColor: reaction.mine ? colors.primary : 'rgba(0,0,0,0.55)', borderRadius: radius.pill, padding: '2px 8px', maxWidth: 110 }}>
        <Text variant="small" color="#fff" lines={1} style={{ fontSize: 10, lineHeight: '13px' }}>{reaction.mine ? 'You' : reaction.author}</Text>
      </span>
    </div>
  );
}

/** Reactions rising over the video, above the control bar. Never intercepts clicks. */
export function FloatingReactions({ reactions, bottom }: { reactions: Reaction[]; bottom: number }) {
  return (
    <div style={{ position: 'absolute', right: 0, width: 160, height: 360, bottom, pointerEvents: 'none', zIndex: 4 }}>
      {reactions.map((r) => <Floater key={r.id} reaction={r} />)}
    </div>
  );
}

export function ReactionPicker({ onPick }: { onPick: (emoji: ReactionEmoji) => void }) {
  return (
    <div className="h a-up stage-card reaction-picker" style={{ alignSelf: 'center', gap: 2, borderRadius: radius.pill, padding: 6, marginBottom: 8 }}>
      {REACTIONS.map((emoji) => (
        <Pressable key={emoji} scaleTo={0.75} onClick={() => onPick(emoji)} aria-label={`React ${emoji}`}
          style={{ width: 42, height: 42, borderRadius: 21, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 24, lineHeight: '30px' }}>{emoji}</span>
        </Pressable>
      ))}
    </div>
  );
}
