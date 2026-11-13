import { useNavigate } from 'react-router';
import { Icon } from '@/components/ui/icon';
import { Chip, delay, EmptyState, Skeleton, Spinner } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { formatDay, formatDuration } from '@/lib/format';
import type { Recording } from '@/lib/types';
import { useQuery } from '@/lib/use-query';
import { colors, radius } from '@/theme';
import { PageHeader } from '@/components/ui/screen';
import { TabPage } from './tab-page';

function RecordingRow({ rec, index }: { rec: Recording; index: number }) {
  const navigate = useNavigate();
  const ready = rec.status === 'ready' && rec.url;
  return (
    <div className="a-down" style={delay(60 + index * 60)}>
      <Pressable
        disabled={!ready}
        scaleTo={0.97}
        onClick={() => navigate(`/recording/${rec.id}?${new URLSearchParams({ url: rec.url!, title: rec.roomTitle })}`)}
        style={{
          display: 'flex', alignItems: 'center', gap: 14, width: '100%', backgroundColor: colors.surface,
          borderRadius: radius.lg, padding: 12, boxShadow: 'var(--shadow-card)', opacity: 1,
        }}
      >
        <span className="h center" style={{ width: 52, height: 52, borderRadius: 16, flexShrink: 0, backgroundColor: ready ? colors.primary : colors.surfaceAlt }}>
          {ready ? <Icon name="play" size={22} color="#fff" /> : <Spinner />}
        </span>
        <div className="v flex1" style={{ gap: 4 }}>
          <Text variant="bodyStrong" lines={1}>{rec.roomTitle}</Text>
          <div className="h" style={{ gap: 6 }}>
            <Text variant="small" color={colors.muted}>{formatDay(rec.recordedAt)}</Text>
            <Text variant="small" color={colors.line}>•</Text>
            <Text variant="small" color={colors.muted}>{rec.subject}</Text>
          </div>
        </div>
        {ready ? <Chip label={formatDuration(rec.durationSec)} /> : <Chip label="Processing" color={colors.student} bg={colors.studentSoft} />}
      </Pressable>
    </div>
  );
}

export default function Recordings() {
  const { data, loading, error, refresh, refreshing } = useQuery(() => api.listRecordings());

  return (
    <TabPage onRefresh={refresh} refreshing={refreshing} gap={12}>
      <PageHeader title="Recordings" subtitle="Every recorded lesson, ready to replay." />

      {loading ? (
        <div className="cards-grid dense">{[0, 1, 2].map((i) => <Skeleton key={i} height={76} />)}</div>
      ) : error ? (
        <EmptyState icon="cloud-offline-outline" title="Can't load recordings" body={error} />
      ) : !data?.length ? (
        <EmptyState icon="videocam-outline" title="Nothing recorded yet" body="When a teacher records a class, it will show up here." />
      ) : (
        <div className="cards-grid dense" style={{ gap: 12 }}>
          {data.map((rec, i) => <RecordingRow key={rec.id} rec={rec} index={i} />)}
        </div>
      )}
    </TabPage>
  );
}
