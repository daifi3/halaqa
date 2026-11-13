import { Icon, type IconName } from '@/components/ui/icon';
import { delay } from '@/components/ui/misc';
import { Text } from '@/components/ui/text';
import { colors, radius } from '@/theme';

/** Three soft shapes drifting slowly — gives the first screen some life. */
export function FloatingHero({ scale = 1 }: { scale?: number }) {
  const blob = (style: React.CSSProperties, anim: string) => (
    <span style={{ position: 'absolute', animation: `${anim} 6s ease-in-out infinite alternate`, ...style }} />
  );
  return (
    <div className="h center" style={{ height: 260 * scale, position: 'relative' }}>
      <div style={{ position: 'relative', width: 340, height: 260, transform: `scale(${scale})`, flexShrink: 0 }}>
        {blob({ width: 170, height: 170, borderRadius: 60, backgroundColor: colors.teacherSoft, left: 16, top: 30 }, 'drift')}
        {blob({ width: 130, height: 130, borderRadius: 65, backgroundColor: colors.studentSoft, right: 20, top: 70 }, 'drift')}
        {blob({ width: 80, height: 80, borderRadius: 24, backgroundColor: colors.successSoft, left: 110, bottom: 10, animationDirection: 'alternate-reverse' }, 'drift')}
        <div className="v a-fade" style={{ ...delay(200), position: 'absolute', left: 75, top: 50, width: 190, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, gap: 10 }}>
          <div className="h center" style={{ height: 100, borderRadius: radius.md, backgroundColor: colors.bg }}>
            <Icon name="easel-outline" size={44} color={colors.primary} />
          </div>
          <div className="h" style={{ gap: 8, justifyContent: 'center' }}>
            {[colors.teacher, colors.student, colors.success].map((c) => (
              <span key={c} style={{ width: 34, height: 34, borderRadius: 17, border: `2px solid ${c}`, backgroundColor: c + '33' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'videocam-outline', title: 'Live classes', body: 'Video, chat and reactions with your whole class.' },
  { icon: 'easel-outline', title: 'A shared whiteboard', body: 'Draw, add shapes and write maths together.' },
  { icon: 'play-circle-outline', title: 'Recorded lessons', body: 'Replay any class whenever you need it.' },
];

/** Desktop only: the left half of the sign-in screens. */
export function AuthArt() {
  return (
    <aside className="auth-art v" style={{ margin: 16, borderRadius: radius.xl, backgroundColor: colors.surface, padding: '40px 48px', gap: 32, justifyContent: 'center', overflow: 'hidden' }}>
      <div className="h a-down" style={{ gap: 10 }}>
        <span className="h center" style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.ink }}>
          <Icon name="easel-outline" size={20} color="#fff" />
        </span>
        <Text variant="title">Halaqa</Text>
      </div>
      <FloatingHero scale={1.35} />
      <div className="v" style={{ gap: 18, maxWidth: 440 }}>
        {FEATURES.map((f, i) => (
          <div key={f.title} className="h a-down" style={{ ...delay(200 + i * 80), gap: 14 }}>
            <span className="h center" style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, flexShrink: 0 }}>
              <Icon name={f.icon} size={20} color={colors.primary} />
            </span>
            <div className="v flex1" style={{ gap: 2 }}>
              <Text variant="bodyStrong">{f.title}</Text>
              <Text variant="small" color={colors.muted}>{f.body}</Text>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
