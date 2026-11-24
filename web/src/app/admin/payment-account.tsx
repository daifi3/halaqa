import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PAGE_SIZES, Pagination } from '@/components/admin/pagination';
import { PaymentRow } from '@/components/admin/payment-row';
import { Button } from '@/components/ui/button';
import { Avatar, Chip, EmptyState, Skeleton } from '@/components/ui/misc';
import { ModalScreen, Section } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { useBack } from '@/lib/navigation';
import { STANDING, standingNote } from '@/lib/payments';
import { ROLES } from '@/lib/roles';
import { useQuery } from '@/lib/use-query';
import { colors, radius } from '@/theme';

function Fact({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="v" style={{ gap: 2, padding: 12, borderRadius: radius.md, backgroundColor: colors.bg, minWidth: 0 }}>
      <Text variant="label" color={colors.muted}>{label}</Text>
      <Text variant="bodyStrong" color={color} lines={1}>{value}</Text>
    </div>
  );
}

/** Admin: one account's standing and full payment history, with record and void. */
export default function PaymentAccount() {
  const { userId = '' } = useParams();
  const navigate = useNavigate();
  const back = useBack('/admin/payments');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(PAGE_SIZES[0]!);
  const detail = useQuery(() => api.getBillingAccount(userId), [userId]);
  const history = useQuery(() => api.listPayments({ userId, page, size }), [userId, page, size]);

  const d = detail.data;
  const a = d?.account;
  const s = a ? STANDING[a.standing] : null;

  return (
    <ModalScreen title="Payments" onClose={back}
      footer={a && a.user.status === 'active'
        ? <Button title="Record a payment" icon="add-circle-outline" onPress={() => navigate(`/admin/payments/record?user=${userId}`)} />
        : undefined}>
      {!d ? (
        detail.error ? <EmptyState icon="cloud-offline-outline" title="Can't load this account" body={detail.error} /> : <Skeleton height={180} />
      ) : (
        <>
          <div className="v a-zoom" style={{ gap: 10, alignItems: 'center', padding: '8px 0 4px', textAlign: 'center' }}>
            <Avatar name={a!.user.name} size={64} uri={a!.user.avatarUrl} ring={ROLES[a!.user.role].tone} />
            <Text variant="heading">{a!.user.name}</Text>
            <Text variant="small" color={colors.muted}>{a!.user.email} · {ROLES[a!.user.role].label}</Text>
            <Chip label={s!.label} icon={s!.icon} color={s!.fg} bg={s!.bg} />
            {a!.user.status === 'deleted' && <Text variant="small" color={colors.danger}>This account is deleted. Restore it to record payments.</Text>}
          </div>
          <div className="pay-facts">
            <Fact label="Paid until" value={a!.paidUntil ? formatDate(a!.paidUntil) : '–'} color={a!.standing === 'overdue' ? colors.danger : undefined} />
            <Fact label="Status" value={standingNote(a!)} color={s!.fg} />
            <Fact label="Total paid" value={formatMoney(d.totalPaid, d.currency)} />
          </div>
        </>
      )}

      <Section title="History" hint="Newest first. Voided payments stay listed but don't count." delayMs={80}>
        {!history.data ? (
          <Skeleton height={80} />
        ) : history.data.items.length === 0 ? (
          <Text color={colors.muted}>No payments recorded yet.</Text>
        ) : (
          <div className="admin-table">
            {history.data.items.map((p, i) => (
              <PaymentRow key={p.id} payment={p} index={i}
                onChange={(u) => {
                  history.setData((h) => h && ({ ...h, items: h.items.map((x) => (x.id === u.id ? u : x)) }));
                  void detail.reload();
                }} />
            ))}
          </div>
        )}
        {history.data && history.data.totalPages > 1 && (
          <Pagination page={history.data.page} totalPages={history.data.totalPages} total={history.data.total} size={size}
            onPage={setPage} onSize={(n) => { setSize(n); setPage(0); }} noun="payments" />
        )}
      </Section>
    </ModalScreen>
  );
}
