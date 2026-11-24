import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useDebounced } from '@/components/admin/pagination';
import { Button } from '@/components/ui/button';
import { ChoiceRow } from '@/components/ui/choice';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Avatar, Chip, Skeleton } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { ModalScreen, Section } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { formatDate, formatMoney, todayIso } from '@/lib/format';
import { useBack } from '@/lib/navigation';
import { coveredPeriod, METHOD_ORDER, METHODS, STANDING, standingNote } from '@/lib/payments';
import { ROLES } from '@/lib/roles';
import type { BillingAccount, PaymentMethod, Role } from '@/lib/types';
import { useQuery } from '@/lib/use-query';
import { colors, radius } from '@/theme';

const MONTHS = [1, 3, 6, 12];

function AccountCard({ a, onChange }: { a: BillingAccount; onChange?: () => void }) {
  const s = STANDING[a.standing];
  return (
    <div className="h a-down" style={{ gap: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.bg }}>
      <Avatar name={a.user.name} size={42} uri={a.user.avatarUrl} ring={ROLES[a.user.role].tone} />
      <div className="v flex1" style={{ gap: 3, minWidth: 0 }}>
        <Text variant="bodyStrong" lines={1}>{a.user.name}</Text>
        <span className="h wrap" style={{ gap: 6 }}>
          <Chip label={s.label} icon={s.icon} color={s.fg} bg={s.bg} />
          <Text variant="small" color={colors.muted}>{a.paidUntil ? `Until ${formatDate(a.paidUntil)} · ` : ''}{standingNote(a)}</Text>
        </span>
      </div>
      {onChange && <Button title="Change" variant="ghost" size="md" onPress={onChange} />}
    </div>
  );
}

/** Pick who paid (when not opened from their row). */
function AccountPicker({ role, onPick }: { role: Role; onPick: (a: BillingAccount) => void }) {
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 250);
  const found = useQuery(() => api.listBillingAccounts({ role, q, size: 6 }), [role, q]);
  return (
    <div className="v" style={{ gap: 8 }}>
      <Input icon="search-outline" value={search} onChangeText={setSearch} placeholder={`Search ${ROLES[role].label.toLowerCase()}s by name or email`}
        autoFocus autoCapitalize="none" autoCorrect="off" type="search" aria-label="Find the account" />
      {!found.data ? <Skeleton height={56} /> : found.data.items.length === 0 ? (
        <Text variant="small" color={colors.muted}>{q ? `Nobody matches “${q}”.` : 'No accounts yet.'}</Text>
      ) : found.data.items.map((a) => (
        <Pressable key={a.user.id} onClick={() => onPick(a)} scaleTo={0.98} className="h"
          style={{ gap: 12, padding: 10, borderRadius: radius.md, backgroundColor: colors.bg, textAlign: 'left' }}>
          <Avatar name={a.user.name} size={36} uri={a.user.avatarUrl} ring={ROLES[a.user.role].tone} />
          <span className="v flex1" style={{ minWidth: 0 }}>
            <Text variant="bodyStrong" lines={1}>{a.user.name}</Text>
            <Text variant="small" color={colors.muted} lines={1}>{a.user.email}</Text>
          </span>
          <Chip label={STANDING[a.standing].label} color={STANDING[a.standing].fg} bg={STANDING[a.standing].bg} />
        </Pressable>
      ))}
    </div>
  );
}

/** Admin: record a payment made outside the app (`?user=` from an account, or `?role=` to search). */
export default function RecordPayment() {
  const [params] = useSearchParams();
  const userId = params.get('user');
  const role = (params.get('role') as Role | null) ?? 'teacher';
  const navigate = useNavigate();
  const back = useBack('/admin/payments');
  const [account, setAccount] = useState<BillingAccount | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(!!userId);
  const [amount, setAmount] = useState('');
  const [months, setMonths] = useState(1);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [paidOn, setPaidOn] = useState(todayIso());
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(a: BillingAccount) {
    setAccount(a);
    // Most renewals repeat the last one: same amount, length and method.
    const last = a.lastPayment;
    if (last) {
      setAmount(String(last.amount));
      setMonths(MONTHS.includes(last.months) ? last.months : 1);
      setMethod(last.method);
    }
  }

  useEffect(() => {
    if (!userId) return;
    api.getBillingAccount(userId).then((d) => pick(d.account)).catch((e) => setError(e instanceof Error ? e.message : 'Account not found'))
      .finally(() => setLoadingAccount(false));
  }, [userId]);

  const today = todayIso();
  const value = Number(amount.replace(',', '.'));
  const amountOk = Number.isFinite(value) && value >= 1 && value <= 10_000_000;
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(paidOn) && paidOn <= today;
  const canSave = !!account && amountOk && dateOk && !saving;
  const period = account && dateOk ? coveredPeriod(account.paidUntil, paidOn, months) : null;

  async function save() {
    if (!canSave || !account) return;
    setSaving(true);
    setError(null);
    try {
      await api.recordPayment({
        userId: account.user.id, amount: value, months, method, paidOn,
        reference: reference.trim() || undefined, note: note.trim() || undefined,
      });
      navigate(`/admin/payments/account/${account.user.id}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record the payment');
      setSaving(false);
    }
  }

  return (
    <ModalScreen title="Record payment" onClose={back}
      footer={<Button title={amountOk && account ? `Record ${formatMoney(value)}` : 'Record payment'} icon="checkmark"
        loading={saving} disabled={!canSave} onPress={save} />}>
      <Section title="Who paid" delayMs={20}>
        {loadingAccount ? <Skeleton height={66} />
          : account ? <AccountCard a={account} onChange={userId ? undefined : () => setAccount(null)} />
            : <AccountPicker role={role} onPick={pick} />}
      </Section>

      <Section title="Amount" hint="In Algerian dinars." delayMs={70}>
        <Input label="Amount (DA)" icon="cash-outline" value={amount} onChangeText={(v) => { setAmount(v.replace(/[^\d.,]/g, '')); setError(null); }}
          inputMode="decimal" placeholder="e.g. 3000" autoComplete="off"
          error={amount && !amountOk ? 'Enter an amount between 1 and 10 000 000' : null} />
        <Text variant="label" color={colors.muted}>Covers</Text>
        <ChoiceRow<number> value={months} onChange={setMonths}
          options={MONTHS.map((m) => ({ value: m, label: m === 12 ? '1 year' : `${m} month${m === 1 ? '' : 's'}` }))} />
        {period && (
          <div className="h a-down" style={{ gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.successSoft }}>
            <Icon name="calendar-outline" size={18} color={colors.success} />
            <Text variant="small" color={colors.success} style={{ flex: 1 }}>
              {formatDate(period.start)} → {formatDate(period.end)}
              {account?.paidUntil && account.paidUntil >= paidOn ? ' (follows on from their current period)' : ''}
            </Text>
          </div>
        )}
      </Section>

      <Section title="How it was paid" delayMs={120}>
        <ChoiceRow<PaymentMethod> wrap value={method} onChange={setMethod}
          options={METHOD_ORDER.map((m) => ({ value: m, label: METHODS[m].label }))} />
        <Input label="Paid on" icon="calendar-outline" type="date" value={paidOn} onChangeText={setPaidOn} max={today}
          error={paidOn > today ? 'Can’t be in the future' : null} />
        <Input label="Reference (optional)" icon="receipt-outline" value={reference} onChangeText={setReference} maxLength={120}
          placeholder="Receipt no., transfer ID…" autoComplete="off" />
        <Input label="Note (optional)" icon="create-outline" value={note} onChangeText={setNote} multiline minHeight={64}
          maxLength={500} placeholder="Anything worth remembering" />
      </Section>
      {error && <Text variant="small" color={colors.danger}>{error}</Text>}
    </ModalScreen>
  );
}
