import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { pickFile } from '@/lib/files';
import { decodeQrImage, joinScanned, useQrScanner } from '@/lib/qr-scan';
import { colors, radius } from '@/theme';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { Spinner } from './ui/misc';
import { Text } from './ui/text';

/** Joining from a QR code, shared by the full-screen scanner and the scan panel of the join page. */
export function useScanToJoin() {
  const navigate = useNavigate();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Frames arrive many times a second with the same code; refs block re-entry synchronously.
  const busy = useRef(false);
  const lastBad = useRef<string | null>(null);

  async function onScanned(data: string) {
    if (busy.current || data === lastBad.current) return;
    busy.current = true;
    setJoining(true);
    setError(null);
    try {
      const { path } = await joinScanned(data);
      navigator.vibrate?.(40);
      navigate(path, { replace: true });
    } catch (e) {
      lastBad.current = data;
      setError(e instanceof Error ? e.message : 'Could not join');
      busy.current = false;
      setJoining(false);
    }
  }

  /** Reads a picture of the QR code — for computers without a camera, or a QR someone sent you. */
  async function fromImage() {
    const file = await pickFile('image/*');
    if (!file) return;
    setError(null);
    const data = await decodeQrImage(file).catch(() => null);
    if (!data) {
      setError('No QR code found in that picture.');
      return;
    }
    lastBad.current = null;
    await onScanned(data);
  }

  return { joining, error, onScanned, fromImage };
}

/**
 * Desktop join page: scan the teacher's QR with the webcam, right next to the code boxes.
 * The camera only turns on when asked, so opening the page never pops a permission prompt.
 */
export function ScanPanel() {
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  const scan = useScanToJoin();
  const camera = useQrScanner(video, on, (data) => void scan.onScanned(data));

  return (
    <div className="v" style={{ gap: 16 }}>
      <div className="v" style={{ gap: 4 }}>
        <Text variant="heading">Scan the QR code</Text>
        <Text variant="small" color={colors.muted}>Hold your teacher’s QR code up to your camera — you join as soon as it’s read.</Text>
      </div>

      <div className="v center" style={{ position: 'relative', aspectRatio: '4 / 3', borderRadius: radius.lg, backgroundColor: colors.ink, overflow: 'hidden' }}>
        {/* Mirrored like any webcam preview; the scanner reads the unmirrored frames. */}
        <video ref={video} playsInline muted style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)',
          opacity: camera === 'on' ? 1 : 0, transition: 'opacity 200ms',
        }} />
        {camera === 'on' ? (
          <>
            <span style={{
              position: 'relative', width: '52%', aspectRatio: '1', borderRadius: radius.lg, border: '3px solid #fff',
              boxShadow: '0 0 0 100vmax rgba(0,0,0,0.3)',
            }} />
            {scan.joining && (
              <div className="v center a-fade" style={{ position: 'absolute', inset: 0, gap: 10, backgroundColor: 'rgba(0,0,0,0.55)' }}>
                <Spinner color="#fff" />
                <Text variant="bodyStrong" color="#fff">Joining…</Text>
              </div>
            )}
            <button type="button" onClick={() => setOn(false)} className="press" style={{
              position: 'absolute', top: 10, right: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 13, fontWeight: 600,
            }}>
              <Icon name="close" size={14} color="#fff" /> Stop camera
            </button>
          </>
        ) : camera === 'asking' ? (
          <Spinner color="#fff" />
        ) : (
          <div className="v center a-fade" style={{ gap: 12, padding: 24, textAlign: 'center' }}>
            <span className="h center" style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <Icon name={camera === 'idle' ? 'qr-code-outline' : 'camera-outline'} size={26} color="#fff" />
            </span>
            <Text variant="small" color={colors.stageMuted} style={{ maxWidth: 280, textAlign: 'center' }}>
              {camera === 'none' ? 'No camera found on this computer. Scan a picture of the QR code instead.'
                : camera === 'denied' ? 'Camera access is blocked. Allow it in your browser’s site settings, or scan a picture instead.'
                  : 'Your camera only turns on while you scan.'}
            </Text>
            {camera === 'idle' && <Button size="md" accent={colors.student} icon="camera-outline" title="Turn on camera" onPress={() => setOn(true)} />}
          </div>
        )}
      </div>

      {scan.error && (
        <div className="h a-down" style={{ gap: 8, padding: '10px 12px', borderRadius: radius.md, backgroundColor: colors.dangerSoft }}>
          <Icon name="alert-circle" size={16} color={colors.danger} />
          <Text variant="small" color={colors.danger} className="flex1">{scan.error}</Text>
        </div>
      )}

      <Button size="md" variant="secondary" icon="image-outline" title="Scan a picture of the QR code" onPress={() => void scan.fromImage()} />
    </div>
  );
}
