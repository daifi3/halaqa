import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { ChoiceRow } from '@/components/ui/choice';
import { Icon, type IconName } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Chip, delay, EmptyState, Skeleton } from '@/components/ui/misc';
import { PageHeader } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { alert } from '@/lib/dialog';
import { timeAgo } from '@/lib/format';
import type { DemoRequest, DemoRequestStatus } from '@/lib/types';
import { useQuery } from '@/lib/use-query';
import { colors, radius } from '@/theme';
import { TabPage } from '../tabs/tab-page';

/** The follow-up steps, in order. Payment is taken outside Halaqa; "paid" means it's ready for an account. */
const STATUS: Record<DemoRequestStatus, { label: string; icon: IconName; fg: string; bg: string }> = {
  new: { label: 'New', icon: 'sparkles', fg: colors.danger, bg: colors.dangerSoft },
  contacted: { label: 'Contacted', icon: 'call', fg: colors.primary, bg: colors.primarySoft },
  awaiting_payment: { label: 'Awaiting payment', icon: 'hourglass', fg: colors.student, bg: colors.studentSoft },
  paid: { label: 'Paid', icon: 'card', fg: colors.success, bg: colors.successSoft },
  account_created: { label: 'Account created', icon: 'checkmark-circle', fg: colors.success, bg: colors.successSoft },
  declined: { label: 'Declined', icon: 'close-circle', fg: colors.muted, bg: colors.surfaceAlt },
};
const FLOW: DemoRequestStatus[] = ['new', 'contacted', 'awaiting_payment', 'paid', 'account_created', 'declined'];
const OPEN: DemoRequestStatus[] = ['new', 'contacted', 'awaiting_payment', 'paid'];

type Filter = 'open' | 'all' | 'account_created' | 'declined';

function RequestCard({ r, index, onChange }: { r: DemoRequest; index: number; onChange: (r: DemoRequest) => void }) {
  const navigate = useNavigate();
  const s = STATUS[r.status];
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(r.adminNote ?? '');
  const [saving, setSaving] = useState(false);

  async function update(patch: { status?: DemoRequestStatus; adminNote?: string }) {
    setSaving(true);
    try {
      onChange(await api.updateDemoRequest(r.id, patch));
      setEditing(false);
    } catch (e) {
      alert('Couldn’t update the request', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function changeStatus() {
    alert('Move this request to…', `${r.name} is “${s.label}”.`, [
      ...FLOW.filter((x) => x !== r.status && x !== 'account_created').map((x) => ({
        text: STATUS[x].label, style: x === 'declined' ? 'destructive' as const : 'default' as const,
        onPress: () => void update({ status: x }),
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const done = r.status === 'account_created' || r.status === 'declined';
  return (
    <article className="a-down v" style={{
      ...delay(60 + Math.min(index, 10) * 40), gap: 12, padding: 16, borderRadius: radius.lg,
      backgroundColor: colors.surface, boxShadow: 'var(--shadow-card)', opacity: r.status === 'declined' ? 0.7 : 1,
    }}>
      <div className="h" style={{ gap: 10, alignItems: 'flex-start' }}>
        <div className="v flex1" style={{ gap: 2, minWidth: 0 }}>
          <Text variant="bodyStrong" lines={1}>{r.name}</Text>
          <Text variant="small" color={colors.muted} lines={1}>{r.organization ?? 'Individual teacher'} · {timeAgo(r.createdAt)}</Text>
        </div>
        <Chip label={s.label} icon={s.icon} color={s.fg} bg={s.bg} />
      </div>

      <div className="h wrap" style={{ gap: 8 }}>
        <a className="admin-contact" href={`mailto:${r.email}`}><Icon name="mail-outline" size={15} />{r.email}</a>
        {r.phone && <a className="admin-contact" href={`tel:${r.phone.replace(/\s+/g, '')}`}><Icon name="call-outline" size={15} />{r.phone}</a>}
      </div>

      {r.message && <Text color={colors.inkSoft} className="pre" style={{ lineHeight: '21px' }}>{r.message}</Text>}

      {editing ? (
        <div className="v" style={{ gap: 8 }}>
          <Input icon="create-outline" value={note} onChangeText={setNote} multiline minHeight={70} maxLength={1000}
            placeholder="Internal note: offer sent, payment method, follow-up date…" autoFocus />
          <div className="h" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <Button title="Cancel" variant="ghost" size="md" onPress={() => { setEditing(false); setNote(r.adminNote ?? ''); }} />
            <Button title="Save note" size="md" loading={saving} onPress={() => void update({ adminNote: note })} />
          </div>
        </div>
      ) : r.adminNote ? (
        <div className="h" style={{ gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: colors.bg, alignItems: 'flex-start' }}>
          <Icon name="document-text-outline" size={15} color={colors.muted} style={{ marginTop: 2 }} />
          <Text variant="small" color={colors.inkSoft} className="pre" style={{ flex: 1 }}>{r.adminNote}</Text>
        </div>
      ) : null}

      {r.user && (
        <Text variant="small" color={colors.success}>Account: {r.user.name} ({r.user.email})</Text>
      )}

      <div className="h wrap" style={{ gap: 8 }}>
        {!done && (
          <Button title="Create account" icon="person-add" size="md" accent={r.status === 'paid' ? colors.success : undefined}
            onPress={() => navigate(`/admin/users/new?request=${r.id}`)} />
        )}
        {r.status !== 'account_created' && <Button title="Change status" variant="secondary" size="md" icon="git-commit-outline" onPress={changeStatus} disabled={saving} />}
        {!editing && <Button title={r.adminNote ? 'Edit note' : 'Add note'} variant="ghost" size="md" icon="create-outline" onPress={() => setEditing(true)} />}
      </div>
    </article>
  );
}

/** Admin: demo requests from the landing page, followed up step by step until the account is created. */
export default function DemoRequests() {
  const { data, setData, loading, error, refresh, refreshing } = useQuery(() => api.listDemoRequests());
  const [filter, setFilter] = useState<Filter>('open');
  const all = data ?? [];
  const count = (f: Filter) => all.filter((r) => match(r, f)).length;
  const shown = all.filter((r) => match(r, filter));

  return (
    <TabPage onRefresh={refresh} refreshing={refreshing} gap={18}>
      <PageHeader eyebrow={<Text variant="label" color={colors.success}>Admin</Text>} title="Demo requests"
        subtitle="Teachers and schools asking to join. Take payment, then create their account." />

      <div className="admin-flow a-down" style={delay(60)} aria-label="Follow-up steps">
        {['new', 'contacted', 'awaiting_payment', 'paid', 'account_created'].map((st, i) => (
          <span key={st} className="h" style={{ gap: 6 }}>
            {i > 0 && <Icon name="chevron-forward" size={14} color={colors.muted} />}
            <Chip label={STATUS[st as DemoRequestStatus].label} icon={STATUS[st as DemoRequestStatus].icon}
              color={STATUS[st as DemoRequestStatus].fg} bg={STATUS[st as DemoRequestStatus].bg} />
          </span>
        ))}
      </div>

      <ChoiceRow<Filter> value={filter} onChange={setFilter} options={[
        { value: 'open', label: `To follow up · ${count('open')}` },
        { value: 'account_created', label: `Done · ${count('account_created')}` },
        { value: 'declined', label: `Declined · ${count('declined')}` },
        { value: 'all', label: `All · ${all.length}` },
      ]} />

      {loading ? (
        <div className="v" style={{ gap: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} height={150} />)}</div>
      ) : error ? (
        <EmptyState icon="cloud-offline-outline" title="Can't load requests" body={error} />
      ) : shown.length === 0 ? (
        <EmptyState icon="mail-open-outline" title={filter === 'open' ? 'All caught up' : 'Nothing here'}
          body={filter === 'open' ? 'New requests from the landing page show up here.' : 'No requests in this list yet.'} />
      ) : (
        <div className="cards-grid" style={{ gap: 14 }}>
          {shown.map((r, i) => (
            <RequestCard key={r.id} r={r} index={i}
              onChange={(u) => setData((d) => d?.map((x) => (x.id === u.id ? u : x)))} />
          ))}
        </div>
      )}
    </TabPage>
  );
}

function match(r: DemoRequest, f: Filter) {
  if (f === 'all') return true;
  if (f === 'open') return OPEN.includes(r.status);
  return r.status === f;
}
