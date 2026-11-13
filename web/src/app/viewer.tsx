import { useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { IconButton, Spinner } from '@/components/ui/misc';
import { Text } from '@/components/ui/text';
import { useBack } from '@/lib/navigation';

const DARK_BUTTON = 'rgba(255,255,255,0.14)';
const MAX_ZOOM = 5;

/** Wheel / pinch to zoom toward the pointer, drag to pan, double-click to zoom in or reset. */
function ImageViewer({ uri, onError }: { uri: string; onError: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const box = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  const clamp = (v: { scale: number; x: number; y: number }) => {
    const scale = Math.min(MAX_ZOOM, Math.max(1, v.scale));
    if (scale === 1) return { scale, x: 0, y: 0 };
    const r = box.current?.getBoundingClientRect();
    const mx = r ? (r.width * (scale - 1)) / 2 : Infinity;
    const my = r ? (r.height * (scale - 1)) / 2 : Infinity;
    return { scale, x: Math.max(-mx, Math.min(mx, v.x)), y: Math.max(-my, Math.min(my, v.y)) };
  };

  /** Zooms to `scale`, keeping the point (cx, cy) — relative to the centre — under the pointer. */
  const zoomAt = (scale: number, cx: number, cy: number) =>
    setView((v) => {
      const k = Math.min(MAX_ZOOM, Math.max(1, scale)) / v.scale;
      return clamp({ scale: v.scale * k, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k });
    });

  const centred = (clientX: number, clientY: number) => {
    const r = box.current!.getBoundingClientRect();
    return [clientX - r.left - r.width / 2, clientY - r.top - r.height / 2] as const;
  };

  const onWheel = (e: WheelEvent) => {
    const [cx, cy] = centred(e.clientX, e.clientY);
    zoomAt(view.scale * Math.exp(-e.deltaY * 0.0015), cx, cy);
  };

  const onPointerDown = (e: PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a!.x - b!.x, a!.y - b!.y), scale: view.scale };
    }
  };
  const onPointerMove = (e: PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const [cx, cy] = centred((a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
      zoomAt(pinch.current.scale * (Math.hypot(a!.x - b!.x, a!.y - b!.y) / pinch.current.dist), cx, cy);
    } else if (view.scale > 1) {
      setView((v) => clamp({ ...v, x: v.x + e.clientX - prev.x, y: v.y + e.clientY - prev.y }));
    }
  };
  const onPointerUp = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  return (
    <div
      ref={box}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={(e) => {
        const [cx, cy] = centred(e.clientX, e.clientY);
        if (view.scale > 1) setView({ scale: 1, x: 0, y: 0 });
        else zoomAt(2.5, cx, cy);
      }}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', touchAction: 'none', cursor: view.scale > 1 ? 'grab' : 'zoom-in' }}
    >
      {!loaded && <div className="v center" style={{ position: 'absolute', inset: 0 }}><Spinner color="#fff" size={28} /></div>}
      <img
        src={uri}
        alt=""
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={onError}
        style={{
          width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none',
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          transition: pointers.current.size ? 'none' : 'transform 120ms ease-out',
        }}
      />
    </div>
  );
}

/** Full-screen viewer for PDFs and images. Browsers render PDFs themselves, with zoom and page navigation. */
export default function Viewer() {
  const [params] = useSearchParams();
  const url = params.get('url') ?? '';
  const title = params.get('title') ?? '';
  const kind = params.get('kind') === 'pdf' ? 'pdf' : 'image';
  const [failed, setFailed] = useState(false);
  const back = useBack();

  const openOutside = () => window.open(url, '_blank', 'noopener');

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: '#000', display: 'flex', flexDirection: 'column' }}>
      <div className="h" style={{ gap: 12, padding: '10px 16px', backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 2 }}>
        <IconButton icon="close" onPress={back} color="#fff" bg={DARK_BUTTON} label="Close" />
        <Text variant="bodyStrong" color="#fff" lines={1} className="flex1" style={{ textAlign: 'center' }}>{title}</Text>
        <IconButton icon="open-outline" onPress={openOutside} color="#fff" bg={DARK_BUTTON} label="Open in a new tab" />
      </div>
      <div style={{ position: 'relative', flex: 1 }}>
        {failed ? (
          <div className="v center" style={{ position: 'absolute', inset: 0, gap: 14, padding: 32 }}>
            <Text variant="heading" color="#fff">Couldn’t show this file</Text>
            <Text color="rgba(255,255,255,0.7)" style={{ textAlign: 'center' }}>
              It may be damaged, or your connection dropped. You can still open it in a new tab.
            </Text>
            <Button title="Open in a new tab" icon="open-outline" onPress={openOutside} />
          </div>
        ) : kind === 'pdf' ? (
          <iframe src={url} title={title || 'PDF'} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, background: '#1b1a22' }} />
        ) : (
          <ImageViewer uri={url} onError={() => setFailed(true)} />
        )}
      </div>
    </div>
  );
}
