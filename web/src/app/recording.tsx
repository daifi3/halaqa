import { useSearchParams } from 'react-router';
import { IconButton } from '@/components/ui/misc';
import { Text } from '@/components/ui/text';
import { useBack } from '@/lib/navigation';

export default function RecordingPlayer() {
  const [params] = useSearchParams();
  const url = params.get('url') ?? '';
  const title = params.get('title') ?? 'Recording';
  const back = useBack('/recordings');

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: '#000', display: 'flex', flexDirection: 'column' }}>
      <div className="h a-down" style={{ gap: 12, padding: 16 }}>
        <IconButton icon="chevron-down" onPress={back} bg="rgba(255,255,255,0.12)" color="#fff" label="Close" />
        <div className="v flex1">
          <Text variant="label" color="rgba(255,255,255,0.5)">Recording</Text>
          <Text variant="heading" color="#fff" lines={1}>{title}</Text>
        </div>
      </div>
      <div className="v flex1 center a-fade" style={{ animationDelay: '150ms', padding: '0 0 24px' }}>
        <video src={url} controls autoPlay playsInline style={{ width: '100%', maxWidth: 1200, maxHeight: '100%', aspectRatio: '16 / 9', background: '#000' }} />
      </div>
    </div>
  );
}
