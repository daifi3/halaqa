import { useRef } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { IconButton, Spinner } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { useBack } from '@/lib/navigation';
import { useScanToJoin } from '@/components/scan-panel';
import { useQrScanner } from '@/lib/qr-scan';
import { colors, radius } from '@/theme';

const FRAME = 240;

export default function Scan() {
  const navigate = useNavigate();
  const back = useBack();
  const video = useRef<HTMLVideoElement>(null);
  const scan = useScanToJoin();
  const camera = useQrScanner(video, true, (data) => void scan.onScanned(data));

  const imageLink = (
    <Pressable onClick={() => void scan.fromImage()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '6px 0' }}>
      <Icon name="image-outline" size={18} color="#fff" />
      <Text variant="bodyStrong" color="#fff">Scan a picture instead</Text>
    </Pressable>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: '#000', display: 'flex', flexDirection: 'column' }}>
      <video ref={video} playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: camera === 'on' ? 1 : 0 }} />

      <div className="v" style={{ position: 'relative', flex: 1, maxWidth: 560, width: '100%', margin: '0 auto' }}>
        <div className="h" style={{ padding: '12px 20px' }}>
          <IconButton icon="close" onPress={back} bg="rgba(0,0,0,0.45)" color="#fff" label="Close" />
        </div>

        {camera === 'asking' || camera === 'idle' ? (
          <div className="v flex1 center"><Spinner color="#fff" /></div>
        ) : camera !== 'on' ? (
          <div className="v flex1 center a-down" style={{ gap: 14, padding: 32 }}>
            <span className="h center" style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)' }}>
              <Icon name="camera-outline" size={28} color="#fff" />
            </span>
            <Text variant="heading" color="#fff" style={{ textAlign: 'center' }}>
              {camera === 'none' ? 'No camera found' : 'Camera access needed'}
            </Text>
            <Text color={colors.stageMuted} style={{ textAlign: 'center', maxWidth: 300 }}>
              {camera === 'none'
                ? 'This device has no camera Halaqa can use. Type the code, or scan a picture of the QR code.'
                : 'Halaqa uses the camera to scan your teacher’s QR code. Allow it in your browser’s site settings, then reload.'}
            </Text>
            {scan.error && <Text variant="small" color="#FF8A8E" style={{ textAlign: 'center' }}>{scan.error}</Text>}
            <Button title="Type the code instead" icon="keypad-outline" accent={colors.student} onPress={() => navigate('/join', { replace: true })} style={{ alignSelf: 'stretch' }} />
            {imageLink}
          </div>
        ) : (
          <>
            <div className="v flex1 center" style={{ padding: 32 }}>
              <div className="h center" style={{ position: 'relative', width: FRAME, height: FRAME, borderRadius: radius.xl, border: '3px solid #fff', overflow: 'hidden', boxShadow: '0 0 0 100vmax rgba(0,0,0,0.35)' }}>
                {scan.joining && <div className="v center a-fade" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}><Spinner color="#fff" /></div>}
              </div>
            </div>
            <div className="v" style={{ padding: 24, gap: 12, position: 'relative' }}>
              <Text variant="heading" color="#fff" style={{ textAlign: 'center' }}>{scan.joining ? 'Joining…' : 'Scan the class QR code'}</Text>
              {scan.error ? (
                <div className="h a-down" style={{ gap: 8, alignSelf: 'center', backgroundColor: colors.danger, padding: '8px 14px', borderRadius: radius.pill }}>
                  <Icon name="alert-circle" size={16} color="#fff" />
                  <Text variant="small" color="#fff">{scan.error}</Text>
                </div>
              ) : (
                <Text variant="small" color="rgba(255,255,255,0.7)" style={{ textAlign: 'center' }}>Ask your teacher to show it from the class or course page.</Text>
              )}
              <Button title="Type the code instead" variant="secondary" icon="keypad-outline" onPress={() => navigate('/join', { replace: true })} />
              {imageLink}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
