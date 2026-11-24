import type { IconName } from '@/components/ui/icon';
import type { BillingAccount, PaymentMethod, Standing } from '@/lib/types';
import { colors } from '@/theme';

export const STANDING: Record<Standing, { label: string; icon: IconName; fg: string; bg: string }> = {
  overdue: { label: 'Overdue', icon: 'alert-circle', fg: colors.danger, bg: colors.dangerSoft },
  due_soon: { label: 'Due soon', icon: 'hourglass', fg: colors.student, bg: colors.studentSoft },
  paid: { label: 'Paid', icon: 'checkmark-circle', fg: colors.success, bg: colors.successSoft },
  never: { label: 'Never paid', icon: 'remove-circle-outline', fg: colors.muted, bg: colors.surfaceAlt },
};

/** The order the filter chips show them: what needs attention first. */
export const STANDING_ORDER: Standing[] = ['overdue', 'due_soon', 'paid', 'never'];

export const METHODS: Record<PaymentMethod, { label: string; icon: IconName }> = {
  cash: { label: 'Cash', icon: 'cash-outline' },
  ccp: { label: 'CCP', icon: 'mail-outline' },
  baridimob: { label: 'BaridiMob', icon: 'phone-portrait-outline' },
  bank_transfer: { label: 'Bank transfer', icon: 'business-outline' },
  card: { label: 'Card', icon: 'card-outline' },
  other: { label: 'Other', icon: 'ellipsis-horizontal-circle-outline' },
};

export const METHOD_ORDER: PaymentMethod[] = ['cash', 'ccp', 'baridimob', 'bank_transfer', 'card', 'other'];

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parts(day: string) {
  return day.split('-').map(Number) as [number, number, number];
}

/**
 * The period a new payment covers, as the server works it out: it follows on from the current paid-until when
 * the account is still covered on the payment date, otherwise it starts on the payment date. Months are
 * calendar months (31 Jan + 1 month ends 28/29 Feb).
 */
export function coveredPeriod(paidUntil: string | null, paidOn: string, months: number) {
  let start = paidOn;
  if (paidUntil && paidUntil >= paidOn) {
    const [y, m, d] = parts(paidUntil);
    start = iso(new Date(y, m - 1, d + 1));
  }
  const [y, m, d] = parts(start);
  const last = new Date(y, m - 1 + months + 1, 0).getDate();
  const sameDay = new Date(y, m - 1 + months, Math.min(d, last));
  sameDay.setDate(sameDay.getDate() - 1);
  return { start, end: iso(sameDay) };
}

/** "18 days left", "Ends today", "Overdue by 3 days", "No payment yet". */
export function standingNote(a: Pick<BillingAccount, 'daysLeft'>) {
  const d = a.daysLeft;
  if (d === null) return 'No payment yet';
  if (d === 0) return 'Ends today';
  if (d > 0) return `${d} day${d === 1 ? '' : 's'} left`;
  return `Overdue by ${-d} day${d === -1 ? '' : 's'}`;
}
