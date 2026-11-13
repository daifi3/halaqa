import qrcodeGenerator from 'qrcode-generator';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { joinLink, type JoinKind } from '@/lib/links';
import { colors, radius } from '@/theme';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

/** Modules of white border the QR spec asks for so scanners can find the code. */
const QUIET = 4;

/** Crisp QR code as one SVG path, horizontal runs merged so no seams show between modules. */
export function QrCode({ value, size = 220 }: { value: string; size?: number }) {
  const { d, n } = useMemo(() => {
    const qr = qrcodeGenerator(0, 'M');
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    let path = '';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (!qr.isDark(r, c)) continue;
        let run = 1;
        while (c + run < count && qr.isDark(r, c + run)) run++;
        path += `M${c + QUIET} ${r + QUIET}h${run}v1h${-run}z`;
        c += run - 1;
      }
    }
    return { d: path, n: count + QUIET * 2 };
  }, [value]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" role="img" aria-label="QR code" style={{ background: '#fff' }}>
      <path d={d} fill={colors.ink} />
    </svg>
  );
}

/**
 * Full-window QR for a projector or a shared screen: big enough to scan from the back of
 * the room, with the code underneath for anyone typing it. Esc or the button closes it.
 */
function Presenter({ kind, code, title, onClose }: { kind: JoinKind; code: string; title?: string; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState(() => Math.min(window.innerHeight * 0.58, window.innerWidth * 0.5));

  useEffect(() => {
    const el = root.current;
    // Real full screen where the browser allows it; the overlay already fills the window otherwise.
    el?.requestFullscreen?.().catch(() => {});
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onResize = () => setSide(Math.min(window.innerHeight * 0.58, window.innerWidth * 0.5));
    // Leaving full screen with the browser's own Esc closes the presenter too.
    const onFs = () => { if (!document.fullscreenElement) onClose(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onFs);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [onClose]);

  const url = joinLink(kind, code).replace(/^https?:\/\//, '').replace(/\?.*$/, '');
  return createPortal(
    <div ref={root} className="v center a-fade" role="dialog" aria-label="Join QR code"
      style={{ position: 'fixed', inset: 0, zIndex: 60, backgroundColor: '#fff', gap: 24, padding: 32 }}>
      <button type="button" onClick={onClose} className="press h center" aria-label="Close"
        style={{ position: 'absolute', top: 24, right: 24, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.bg }}>
        <Icon name="close" size={22} color={colors.ink} />
      </button>
      <div className="v" style={{ alignItems: 'center', gap: 6 }}>
        <Text variant="label" color={colors.primary}>{kind === 'course' ? 'Join the course' : 'Join the class'}</Text>
        {title && <Text variant="display" style={{ textAlign: 'center' }}>{title}</Text>}
      </div>
      <QrCode value={joinLink(kind, code)} size={side} />
      <div className="v" style={{ alignItems: 'center', gap: 8 }}>
        <Text color={colors.muted}>Scan with your phone, or go to <Text variant="bodyStrong">{url}</Text> and enter</Text>
        <span style={{ fontFamily: 'inherit', fontWeight: 800, fontSize: Math.max(40, side * 0.16), letterSpacing: '0.25em', color: colors.ink, paddingLeft: '0.25em' }}>
          {code}
        </span>
      </div>
    </div>,
    document.body,
  );
}

/** The card a teacher shows the class: QR of the join link, plus the code as a fallback. */
export function JoinQrPanel({ kind, code, title }: { kind: JoinKind; code: string; title?: string }) {
  const [presenting, setPresenting] = useState(false);
  // Stable, so the presenter's full-screen effect runs once.
  const stopPresenting = useCallback(() => setPresenting(false), []);
  return (
    <div className="v a-down qr-panel" style={{ alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: radius.xl, padding: 24, boxShadow: 'var(--shadow-card)' }}>
      <QrCode value={joinLink(kind, code)} />
      <div className="v qr-info" style={{ alignItems: 'center', gap: 14 }}>
      <div className="v" style={{ alignItems: 'center', gap: 4 }}>
        <Text variant="heading">Scan to join</Text>
        <Text variant="small" color={colors.muted} style={{ textAlign: 'center', maxWidth: 260 }}>
          Students scan this with their phone camera or from the Join screen in Halaqa, or type the code.
        </Text>
      </div>
      <div className="h" style={{ gap: 6, backgroundColor: colors.surfaceAlt, padding: '8px 14px', borderRadius: radius.pill }}>
        <Icon name="keypad-outline" size={14} color={colors.muted} />
        <Text variant="small" color={colors.muted}>or type</Text>
        <Text variant="bodyStrong" style={{ letterSpacing: 3 }}>{code}</Text>
      </div>
      <Button size="md" variant="secondary" icon="expand-outline" title="Present full screen" onPress={() => setPresenting(true)} />
      </div>
      {presenting && <Presenter kind={kind} code={code} title={title} onClose={stopPresenting} />}
    </div>
  );
}
