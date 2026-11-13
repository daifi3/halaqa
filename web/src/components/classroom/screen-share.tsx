import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '@/components/ui/icon';
import { Switch } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { containRect, INK_HOLD_MS } from '@/lib/screen-ink';
import type { Peer } from '@/lib/screen-share';
import { colors, radius } from '@/theme';
import { inkOpacity, type InkStroke, type useScreenInk } from './use-screen-ink';
import type { ActiveShare, StudentNotice } from './use-screen-share';

/* ---------- The shared screen itself ---------- */

/** Stand-in for a remote screen in mock mode, where there's no real video. */
function DemoScreen({ name }: { name: string }) {
  return (
    <div className="v" style={{ position: 'absolute', inset: 0, backgroundColor: '#F4F2EE' }}>
      <div className="h" style={{ gap: 6, padding: '48px 12px 10px', backgroundColor: '#E2DED6' }}>
        {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <span key={c} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c }} />)}
        <Text variant="small" color="#5B5D66" style={{ marginLeft: 8 }} lines={1}>{name}’s screen · preview</Text>
      </div>
      <div className="v" style={{ padding: 18, gap: 10 }}>
        <span style={{ width: '62%', height: 14, borderRadius: 5, backgroundColor: '#2B2D35' }} />
        {[92, 84, 88, 70].map((w, i) => <span key={i} style={{ width: `${w}%`, height: 9, borderRadius: 5, backgroundColor: '#CFCAC0' }} />)}
        <div className="h" style={{ alignItems: 'flex-end', gap: 10, height: 120, marginTop: 12 }}>
          {[40, 68, 52, 84, 60].map((h, i) => <span key={i} style={{ flex: 1, borderRadius: 6, backgroundColor: colors.primary, height: `${h}%` }} />)}
        </div>
      </div>
    </div>
  );
}

const pill: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: radius.pill };

export type ScreenInk = ReturnType<typeof useScreenInk>;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** "x,y x,y …" for an SVG polyline; a single tap gets a twin point so it shows as a dot. */
function polyline(points: number[]) {
  const pts = points.length === 2 ? [...points, points[0]! + 0.0001, points[1]!] : points;
  let d = '';
  for (let i = 0; i < pts.length; i += 2) d += `${i ? ' ' : ''}${pts[i]},${pts[i + 1]}`;
  return d;
}

/**
 * Strokes over the shared picture. Lines up with the video where it's actually
 * drawn ("contain" leaves bars around it), so a circle lands on the same spot
 * for everyone. Takes pointer input only while `drawing` is on.
 */
function InkLayer({ ink, drawing }: { ink: ScreenInk; drawing: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [aspect, setAspect] = useState<number | null>(null);
  const pressed = useRef(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    // The shared screen's real proportions, from the <video> next to this layer (none in mock mode).
    const video = el.parentElement?.querySelector('video');
    const read = () => { if (video?.videoWidth) setAspect(video.videoWidth / video.videoHeight); };
    read();
    video?.addEventListener('loadedmetadata', read);
    video?.addEventListener('resize', read);
    return () => {
      ro.disconnect();
      video?.removeEventListener('loadedmetadata', read);
      video?.removeEventListener('resize', read);
    };
  }, []);

  const rect = containRect(size.w, size.h, aspect);
  const at = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [clamp01((e.clientX - r.left) / r.width), clamp01((e.clientY - r.top) / r.height)] as const;
  };
  const release = () => {
    if (!pressed.current) return;
    pressed.current = false;
    ink.end();
  };

  // One name tag per person (not you), at the start of their latest stroke.
  const tags = new Map<string, InkStroke>();
  for (const s of ink.strokes) if (!s.mine) tags.set(s.author, s);

  return (
    <div ref={box} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h,
          pointerEvents: drawing ? 'auto' : 'none', touchAction: drawing ? 'none' : undefined, cursor: drawing ? 'crosshair' : undefined,
        }}
        onPointerDown={(e) => {
          if (!drawing || e.button > 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          pressed.current = true;
          ink.begin(...at(e));
        }}
        onPointerMove={(e) => { if (pressed.current) ink.move(...at(e)); }}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <svg viewBox="0 0 1 1" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
          {ink.strokes.map((s) => (
            <polyline key={s.key} points={polyline(s.points)} fill="none" stroke={s.color} strokeWidth={4}
              strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={inkOpacity(s, ink.now)}
              style={{ filter: 'drop-shadow(0 0 1.5px rgba(0,0,0,0.55))' }} />
          ))}
        </svg>
        {[...tags.values()].map((s) => (
          <span key={s.author} style={{
            position: 'absolute', left: `${s.points[0]! * 100}%`, top: `${s.points[1]! * 100}%`, transform: 'translate(-50%, calc(-100% - 10px))',
            backgroundColor: s.color, color: '#16171C', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: radius.pill,
            whiteSpace: 'nowrap', opacity: inkOpacity(s, ink.now), pointerEvents: 'none',
          }}>{s.author}</span>
        ))}
      </div>
    </div>
  );
}

export function ScreenView({ share, onStop, ink, drawing, onToggleDraw }: {
  share: ActiveShare;
  /** Shown to the sharer, and to the teacher for a student's share. */
  onStop?: () => void;
  ink: ScreenInk;
  /** Your pen is on: dragging over the screen draws on it for everyone. */
  drawing: boolean;
  onToggleDraw: () => void;
}) {
  return (
    <div className="a-fade" style={{ position: 'relative', flex: 1, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000', minHeight: 0 }}>
      {share.video ? (
        // Your own share shows as a live preview too, so you can see what others draw on it.
        <div style={{ position: 'absolute', inset: 0 }}>{share.video}</div>
      ) : share.isLocal ? (
        <div className="v center" style={{ position: 'absolute', inset: 0, gap: 10, padding: 24, backgroundColor: colors.stageCard }}>
          <span className="h center" style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: colors.primary, marginBottom: 6 }}>
            <Icon name="desktop" size={28} color="#fff" />
          </span>
          <Text variant="heading" color={colors.stageText}>You’re sharing your screen</Text>
          <Text color={colors.stageMuted} style={{ textAlign: 'center', maxWidth: 280 }}>
            Everyone in class sees what you share, including notifications.
          </Text>
        </div>
      ) : (
        <DemoScreen name={share.name} />
      )}

      <InkLayer ink={ink} drawing={drawing} />

      <div className="h" style={{ position: 'absolute', left: 10, right: 10, top: 10, gap: 8, pointerEvents: 'none' }}>
        <span style={{ ...pill, padding: '5px 10px', backgroundColor: 'rgba(0,0,0,0.6)', marginRight: 'auto', minWidth: 0 }}>
          <Icon name="desktop-outline" size={13} color={colors.stageText} />
          <Text variant="small" color={colors.stageText} lines={1}>{share.isLocal ? 'You' : share.name} · sharing</Text>
        </span>
        <Pressable scaleTo={0.92} onClick={onToggleDraw} aria-pressed={drawing} aria-label={drawing ? 'Stop drawing' : 'Draw on the screen'}
          style={{ ...pill, pointerEvents: 'auto', backgroundColor: drawing ? colors.primary : 'rgba(0,0,0,0.6)' }}>
          <Icon name={drawing ? 'brush' : 'brush-outline'} size={13} color="#fff" />
          <Text variant="small" color="#fff">{drawing ? 'Drawing' : 'Draw'}</Text>
        </Pressable>
        {onStop && (
          <Pressable scaleTo={0.92} onClick={onStop} style={{ ...pill, pointerEvents: 'auto', backgroundColor: colors.danger }}>
            <Icon name="stop" size={12} color="#fff" />
            <Text variant="small" color="#fff">{share.isLocal ? 'Stop sharing' : 'Stop share'}</Text>
          </Pressable>
        )}
      </div>

      {drawing && (
        <span style={{ ...pill, position: 'absolute', left: '50%', bottom: 10, transform: 'translateX(-50%)', maxWidth: 'calc(100% - 20px)', backgroundColor: 'rgba(0,0,0,0.6)', pointerEvents: 'none' }}>
          <Text variant="small" color={colors.stageText} lines={1}>Everyone sees your drawing · it fades after {INK_HOLD_MS / 1000} s</Text>
        </span>
      )}
    </div>
  );
}

/* ---------- Teacher ---------- */

const panelAction: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, width: '100%', borderRadius: radius.md, backgroundColor: colors.primary,
};

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
    <div className="v a-up stage-card" style={{ margin: '0 12px 8px', padding: 12, gap: 10 }}>
      <Pressable scaleTo={0.97} onClick={onToggleMine} style={{ ...panelAction, backgroundColor: sharing ? colors.danger : colors.primary }}>
        <Icon name={sharing ? 'stop-circle-outline' : 'desktop-outline'} size={18} color="#fff" />
        <Text variant="bodyStrong" color="#fff">{sharing ? 'Stop sharing my screen' : 'Share my screen'}</Text>
      </Pressable>

      {studentShare && (
        <Pressable scaleTo={0.97} onClick={onStopStudent} style={{ ...panelAction, backgroundColor: colors.stageLine }}>
          <Icon name="close-circle-outline" size={18} color={colors.stageText} />
          <Text variant="bodyStrong" color={colors.stageText} lines={1}>Stop {studentShare.name}’s share</Text>
        </Pressable>
      )}

      <div className="h" style={{ gap: 12, padding: '0 4px' }}>
        <div className="v flex1" style={{ gap: 2 }}>
          <Text variant="bodyStrong" color={colors.stageText}>Students can share without asking</Text>
          <Text variant="small" color={colors.stageMuted}>When off, students send you a request first.</Text>
        </div>
        <Switch value={policyOpen} onChange={onPolicy} label="Students can share without asking" />
      </div>
    </div>
  );
}

const answer: React.CSSProperties = { padding: '7px 12px', borderRadius: radius.pill };

export function RequestCard({ peer, onAnswer }: { peer: Peer; onAnswer: (allow: boolean) => void }) {
  return (
    <div className="h a-up stage-card" style={{ gap: 10, margin: '0 12px 8px', padding: '10px 10px 10px 12px' }}>
      <span className="h center" style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: colors.primary, flexShrink: 0 }}>
        <Icon name="desktop-outline" size={16} color="#fff" />
      </span>
      <Text variant="small" color={colors.stageText} className="flex1">
        <Text variant="small" color={colors.stageText} style={{ fontWeight: 700 }}>{peer.name}</Text> wants to share their screen
      </Text>
      <Pressable scaleTo={0.9} onClick={() => onAnswer(false)} style={{ ...answer, backgroundColor: colors.stageLine }}>
        <Text variant="small" color={colors.stageText}>Decline</Text>
      </Pressable>
      <Pressable scaleTo={0.9} onClick={() => onAnswer(true)} style={{ ...answer, backgroundColor: colors.success }}>
        <Text variant="small" color="#fff">Allow</Text>
      </Pressable>
    </div>
  );
}

/* ---------- Student ---------- */

const NOTICE: Record<Exclude<StudentNotice, null>, { icon: IconName; text: string; tint: string }> = {
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
      <div key={notice} className="h a-up stage-card" style={{ gap: 10, margin: '0 12px 8px', padding: '10px 10px 10px 12px' }}>
        <Icon name={n.icon} size={18} color={n.tint} />
        <Text variant="small" color={colors.stageText} className="flex1">{n.text}</Text>
        {notice === 'granted' ? (
          <Pressable scaleTo={0.9} onClick={onShare} style={{ ...answer, backgroundColor: colors.success }}>
            <Text variant="small" color="#fff">Share now</Text>
          </Pressable>
        ) : (
          <Pressable scaleTo={0.9} onClick={onDismiss} aria-label="Dismiss">
            <Icon name="close" size={18} color={colors.stageMuted} />
          </Pressable>
        )}
      </div>
    );
  }
  if (!pending) return null;
  return (
    <div className="h a-up stage-card" style={{ gap: 10, margin: '0 12px 8px', padding: '10px 10px 10px 12px' }}>
      <Icon name="hourglass-outline" size={16} color={colors.stageMuted} />
      <Text variant="small" color={colors.stageMuted} className="flex1">Waiting for your teacher to accept your screen share…</Text>
    </div>
  );
}
