import { LiveKitRoom } from '@livekit/components-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { DemoStage } from '@/components/classroom/demo-stage';
import { LiveStage } from '@/components/classroom/live-stage';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/misc';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { config } from '@/lib/config';
import { useBack } from '@/lib/navigation';
import type { JoinCredentials, Room } from '@/lib/types';
import { useIsTeacher } from '@/store/session';
import { colors } from '@/theme';

const center: React.CSSProperties = {
  position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: 14, padding: 32, backgroundColor: colors.stage,
};

export default function Classroom() {
  const { id = '' } = useParams();
  const isTeacher = useIsTeacher();
  const back = useBack(`/room/${id}`);
  const [room, setRoom] = useState<Room | null>(null);
  const [creds, setCreds] = useState<JoinCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([api.getRoom(id), api.getJoinCredentials(id)])
      .then(([r, c]) => { if (alive) { setRoom(r); setCreds(c); } })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Could not join the class'));
    return () => { alive = false; };
  }, [id]);

  async function leave(endForAll: boolean) {
    if (endForAll && room) await api.endRoom(room.id).catch(() => {});
    back();
  }

  if (error) {
    return (
      <div style={center}>
        <Text variant="heading" color={colors.stageText}>Couldn&apos;t join</Text>
        <Text color={colors.stageMuted} style={{ textAlign: 'center' }}>{error}</Text>
        <Button title="Go back" variant="secondary" onPress={back} style={{ alignSelf: 'stretch', maxWidth: 360, margin: '0 auto', width: '100%' }} />
      </div>
    );
  }

  if (!room || !creds) {
    return (
      <div className="a-fade" style={center}>
        <Spinner color="#fff" />
        <Text color={colors.stageMuted}>Preparing your classroom…</Text>
      </div>
    );
  }

  if (config.useMock) return <DemoStage room={room} isTeacher={isTeacher} onLeave={leave} />;

  return (
    <LiveKitRoom
      serverUrl={creds.serverUrl}
      token={creds.token}
      connect
      audio
      video
      options={{ adaptiveStream: true, dynacast: true }}
      onError={(e) => setError(e.message)}
    >
      <LiveStage room={room} isTeacher={isTeacher} onLeave={leave} />
    </LiveKitRoom>
  );
}
