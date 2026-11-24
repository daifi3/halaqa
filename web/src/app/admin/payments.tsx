import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { PAGE_SIZES, Pagination, useDebounced } from '@/components/admin/pagination';
import { PaymentRow } from '@/components/admin/payment-row';
import { Button } from '@/components/ui/button';
import { ChoiceRow } from '@/components/ui/choice';
import { Icon, type IconName } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Avatar, Chip, delay, EmptyState, IconButton, Skeleton } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { PageHeader } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { METHODS, STANDING, STANDING_ORDER, standingNote } from '@/lib/payments';
import { ROLES } from '@/lib/roles';
import type { BillingAccount, Role, Standing } from '@/lib/types';
import { useQuery } from '@/lib/use-query';
import { colors, radius } from '@/theme';
import { TabPage } from '../tabs/tab-page';

type Tab = 'accounts' | 'history';
/** Admins aren't billed. */
type BilledRole = Exclude<Role, 'admin'>;

function SummaryTile({ label, value, sub, tone, icon, index, onPress }: {
  label: string; value: string; sub?: string; tone: string; icon: IconName; index: number; onPress?: () => void;
}) {
  const body = (
    <>
      <span className="h center" style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: tone + '1F' }}>
        <Icon name={icon} size={18} color={tone} />
      </span>
      <Text variant="title" lines={1}>{value}</Text>
      <Text variant="small" color={colors.muted}>{label}{sub ? ` · ${sub}` : ''}</Text>
    </>
  );
  const style = {
    ...delay(40 + index * 50), display: 'flex', flexDirection: 'column' as const, gap: 6, padding: 14, borderRadius: radius.lg,
    backgroundColor: colors.surface, boxShadow: 'var(--shadow-card)', textAlign: 'left' as const, width: '100%', minWidth: 0,
  };
  return onPress
    ? <Pressable className="a-down" scaleTo={0.97} onClick={onPress} style={style}>{body}</Pressable>
    : <div className="a-down" style={style}>{body}</div>;
}

function AccountRow({ a, index, onOpen, onRecord }: { a: BillingAccount; index: number; onOpen: () => void; onRecord: () => void }) {
  const s = STANDING[a.standing];
  const r = ROLES[a.user.role];
  const last = a.lastPayment;
  return (
    <div className="admin-row pay-row a-down" style={delay(30 + Math.min(index, 12) * 20)}>
      <Pressable onClick={onOpen} scaleTo={0.99} className="h" style={{ gap: 12, minWidth: 0, textAlign: 'left' }}
        aria-label={`Open ${a.user.name}'s payments`}>
        <Avatar name={a.user.name} size={38} uri={a.user.avatarUrl} ring={r.tone} />
        <span className="v" style={{ gap: 1, minWidth: 0 }}>
          <Text variant="bodyStrong" lines={1}>{a.user.name}</Text>
          <Text variant="small" color={colors.muted} lines={1}>{a.user.email}</Text>
        </span>
      </Pressable>
      <span className="v" style={{ gap: 4 }}>
        <Chip label={s.label} icon={s.icon} color={s.fg} bg={s.bg} />
        <Text variant="small" color={a.standing === 'overdue' ? colors.danger : colors.muted}>
          {a.paidUntil ? `Until ${formatDate(a.paidUntil)} · ` : ''}{standingNote(a)}
        </Text>
      </span>
      <span className="admin-col-date v" style={{ gap: 2 }}>
        {last ? (
          <>
            <Text variant="bodyStrong">{formatMoney(last.amount, last.currency)}</Text>
            <Text variant="small" color={colors.muted}>{METHODS[last.method].label} · {formatDate(last.paidOn)}</Text>
          </>
        ) : <Text variant="small" color={colors.muted}>–</Text>}
      </span>
      <span className="h" style={{ gap: 6, justifyContent: 'flex-end' }}>
        <span className="desktop-only">
          <Button title="Record payment" icon="add-circle-outline" size="md"
            accent={a.standing === 'overdue' ? colors.danger : undefined} onPress={onRecord} />
        </span>
        <span className="mobile-only">
          <IconButton icon="add" label={`Record a payment for ${a.user.name}`} size={38}
            bg={a.standing === 'overdue' ? colors.danger : colors.inverse} color="#fff" onPress={onRecord} />
        </span>
      </span>
    </div>
  );
}

/** Admin: who has paid, who is overdue, and every payment recorded. Payment itself happens outside the app. */
export default function Payments() {
  const navigate = useNavigate();
  const topRef = useRef<HTMLDivElement>(null);
  const [role, setRole] = useState<BilledRole>('teacher');
  const [tab, setTab] = useState<Tab>('accounts');
  const [standing, setStanding] = useState<Standing | 'all'>('all');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(PAGE_SIZES[0]!);

  useEffect(() => { setPage(0); }, [q, standing, role, tab, size]);

  const summary = useQuery(() => api.getPaymentSummary(role), [role]);
  const accounts = useQuery(
    () => (tab === 'accounts'
      ? api.listBillingAccounts({ role, standing: standing === 'all' ? undefined : standing, q, page, size })
      : Promise.resolve(undefined)),
    [tab, role, standing, q, page, size],
  );
  const history = useQuery(
    () => (tab === 'history' ? api.listPayments({ page, size }) : Promise.resolve(undefined)),
    [tab, page, size],
  );

  const current = tab === 'accounts' ? accounts.data : history.data;
  useEffect(() => {
    if (current && current.totalPages > 0 && page >= current.totalPages) setPage(current.totalPages - 1);
  }, [current, page]);

  function goTo(p: number) {
    setPage(p);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const sm = summary.data;
  const counts = accounts.data?.counts;
  const record = (userId?: string) => navigate(`/admin/payments/record${userId ? `?user=${userId}` : `?role=${role}`}`);
  const plural = `${ROLES[role].label.toLowerCase()}s`;

  return (
    <TabPage onRefresh={() => { void summary.refresh(); return tab === 'accounts' ? accounts.refresh() : history.refresh(); }}
      refreshing={accounts.refreshing || history.refreshing} gap={18}>
      <div className="h" style={{ gap: 12, alignItems: 'flex-start' }}>
        <div className="flex1">
          <PageHeader eyebrow={<Text variant="label" color={colors.success}>Admin</Text>} title="Payments"
            subtitle="Record what each account paid and see who is due. Payment itself happens outside Halaqa."
            actions={<Button title="Record payment" icon="add-circle-outline" size="md" onPress={() => record()} />} />
        </div>
        <span className="mobile-only">
          <IconButton icon="add" label="Record payment" bg={colors.inverse} color="#fff" size={48}
            onPress={() => record()} style={{ marginTop: 14, marginRight: 44 }} />
        </span>
      </div>

      <ChoiceRow<BilledRole> value={role} onChange={(r) => { setRole(r); setStanding('all'); }} accent={ROLES[role].tone} options={[
        { value: 'teacher', label: 'Teachers' },
        { value: 'student', label: 'Students' },
      ]} />

      <div className="admin-stats">
        <SummaryTile index={0} label="Collected this month" value={sm ? formatMoney(sm.collectedThisMonth, sm.currency) : '–'}
          tone={colors.success} icon="wallet" />
        <SummaryTile index={1} label="This year" value={sm ? formatMoney(sm.collectedThisYear, sm.currency) : '–'}
          tone={colors.primary} icon="trending-up" />
        <SummaryTile index={2} label="Overdue" value={sm ? String(sm.overdue) : '–'} sub={sm ? `${sm.never} never paid` : undefined}
          tone={colors.danger} icon="alert-circle" onPress={() => { setTab('accounts'); setStanding('overdue'); }} />
        <SummaryTile index={3} label="Due within 7 days" value={sm ? String(sm.dueSoon) : '–'} sub={sm ? `${sm.paid} paid up` : undefined}
          tone={colors.student} icon="hourglass" onPress={() => { setTab('accounts'); setStanding('due_soon'); }} />
      </div>

      <div ref={topRef} className="v" style={{ gap: 12, scrollMarginTop: 16 }}>
        <ChoiceRow<Tab> value={tab} onChange={setTab} accent={colors.inverse} options={[
          { value: 'accounts', label: `By ${ROLES[role].label.toLowerCase()}` },
          { value: 'history', label: 'All payments' },
        ]} />
        {tab === 'accounts' && (
          <>
            <Input icon="search-outline" value={search} onChangeText={setSearch} placeholder={`Search ${plural} by name or email`}
              autoCapitalize="none" autoCorrect="off" type="search" aria-label={`Search ${plural}`} />
            <ChoiceRow<Standing | 'all'> value={standing} onChange={setStanding} options={[
              { value: 'all', label: `All · ${counts?.all ?? '–'}` },
              ...STANDING_ORDER.map((s) => ({ value: s, label: `${STANDING[s].label} · ${counts?.[s] ?? '–'}` })),
            ]} />
          </>
        )}
      </div>

      {tab === 'accounts' ? (
        !accounts.data && accounts.loading ? (
          <div className="v" style={{ gap: 10 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={64} />)}</div>
        ) : accounts.error && !accounts.data ? (
          <EmptyState icon="cloud-offline-outline" title="Can't load payments" body={accounts.error} />
        ) : !accounts.data?.items.length ? (
          <EmptyState icon="wallet-outline" title={q ? 'No match' : standing === 'all' ? `No ${plural} yet` : 'Nobody here'}
            body={q ? `Nobody matches “${q}”.` : standing === 'overdue' ? 'Nobody is overdue. 🎉' : `No ${plural} in this list.`} />
        ) : (
          <div className="admin-table" style={{ opacity: accounts.loading ? 0.55 : 1, transition: 'opacity 160ms ease' }} aria-busy={accounts.loading}>
            <div className="admin-row pay-row admin-head" aria-hidden>
              <Text variant="label" color={colors.muted}>{ROLES[role].label}</Text>
              <Text variant="label" color={colors.muted}>Standing</Text>
              <span className="admin-col-date"><Text variant="label" color={colors.muted}>Last payment</Text></span>
              <span />
            </div>
            {accounts.data.items.map((a, i) => (
              <AccountRow key={a.user.id} a={a} index={i} onOpen={() => navigate(`/admin/payments/account/${a.user.id}`)}
                onRecord={() => record(a.user.id)} />
            ))}
          </div>
        )
      ) : !history.data && history.loading ? (
        <div className="v" style={{ gap: 10 }}>{[0, 1, 2].map((i) => <Skeleton key={i} height={72} />)}</div>
      ) : history.error && !history.data ? (
        <EmptyState icon="cloud-offline-outline" title="Can't load payments" body={history.error} />
      ) : !history.data?.items.length ? (
        <EmptyState icon="receipt-outline" title="No payments yet" body="Payments you record show up here, newest first." />
      ) : (
        <div className="admin-table" style={{ opacity: history.loading ? 0.55 : 1, transition: 'opacity 160ms ease' }}>
          {history.data.items.map((p, i) => (
            <PaymentRow key={p.id} payment={p} index={i} showPerson
              onOpenPerson={() => navigate(`/admin/payments/account/${p.user.id}`)}
              onChange={(u) => { history.setData((d) => d && ({ ...d, items: d.items.map((x) => (x.id === u.id ? u : x)) })); void summary.reload(); }} />
          ))}
        </div>
      )}

      {current && current.total > 0 && (
        <Pagination page={current.page} totalPages={current.totalPages} total={current.total} size={size}
          onPage={goTo} onSize={setSize} noun={tab === 'accounts' ? plural : 'payments'} />
      )}
    </TabPage>
  );
}
