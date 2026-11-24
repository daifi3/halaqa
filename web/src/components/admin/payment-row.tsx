import { useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { Avatar, Chip, delay, IconButton } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { alert } from '@/lib/dialog';
import { formatDate, formatMoney } from '@/lib/format';
import { METHODS } from '@/lib/payments';
import { ROLES } from '@/lib/roles';
import type { Payment } from '@/lib/types';
import { colors } from '@/theme';

/**
 * One recorded payment: amount, period covered, method and reference, who recorded it.
 * A voided payment stays listed, struck through, with the reason.
 */
export function PaymentRow({ payment: p, index, showPerson, onOpenPerson, onChange }: {
  payment: Payment; index: number; showPerson?: boolean; onOpenPerson?: () => void; onChange: (p: Payment) => void;
}) {
  const [busy, setBusy] = useState(false);
  const isVoid = p.status === 'void';
  const m = METHODS[p.method];

  function confirmVoid() {
    alert('Void this payment?', `${formatMoney(p.amount, p.currency)} from ${p.user.name}, paid ${formatDate(p.paidOn)}. `
      + 'It stays in the history but no longer counts, and their paid-until date is worked out again without it.', [
      { text: 'Cancel', style: 'cancel' },
      ...(['Entered by mistake', 'Payment refunded', 'Payment bounced'] as const).map((reason) => ({
        text: `Void: ${reason.toLowerCase()}`, style: 'destructive' as const,
        onPress: async () => {
          setBusy(true);
          try {
            onChange(await api.voidPayment(p.id, reason));
          } catch (e) {
            alert('Couldn’t void the payment', e instanceof Error ? e.message : 'Please try again.');
          } finally {
            setBusy(false);
          }
        },
      })),
    ]);
  }

  return (
    <div className="admin-row payment-row a-down" style={{ ...delay(30 + Math.min(index, 12) * 20), opacity: isVoid ? 0.6 : 1 }}>
      <span className="h" style={{ gap: 12, minWidth: 0 }}>
        {showPerson ? (
          <Pressable onClick={onOpenPerson} scaleTo={0.95} aria-label={`Open ${p.user.name}'s payments`}>
            <Avatar name={p.user.name} size={38} uri={p.user.avatarUrl} ring={ROLES[p.user.role].tone} />
          </Pressable>
        ) : (
          <span className="h center" style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: isVoid ? colors.surfaceAlt : colors.successSoft, flexShrink: 0 }}>
            <Icon name={m.icon} size={18} color={isVoid ? colors.muted : colors.success} />
          </span>
        )}
        <span className="v" style={{ gap: 2, minWidth: 0 }}>
          <span className="h wrap" style={{ gap: 8, minWidth: 0 }}>
            <Text variant="bodyStrong" style={{ textDecoration: isVoid ? 'line-through' : undefined }}>
              {formatMoney(p.amount, p.currency)}
            </Text>
            {showPerson && (
              <Pressable onClick={onOpenPerson} style={{ minWidth: 0 }}>
                <Text color={colors.inkSoft} lines={1}>{p.user.name}</Text>
              </Pressable>
            )}
            {isVoid && <Chip label="Void" icon="close-circle" color={colors.danger} bg={colors.dangerSoft} />}
          </span>
          <Text variant="small" color={colors.muted} lines={2}>
            {p.months} month{p.months === 1 ? '' : 's'}: {formatDate(p.periodStart)} → {formatDate(p.periodEnd)}
          </Text>
          <Text variant="small" color={colors.muted} lines={2}>
            {m.label}{p.reference ? ` · ${p.reference}` : ''} · paid {formatDate(p.paidOn)} · by {p.recordedBy.name}
          </Text>
          {p.note && <Text variant="small" color={colors.inkSoft} className="pre">{p.note}</Text>}
          {isVoid && p.voidReason && <Text variant="small" color={colors.danger}>Voided: {p.voidReason}</Text>}
        </span>
      </span>
      <span className="h" style={{ justifyContent: 'flex-end' }}>
        {!isVoid && (
          <IconButton icon="close-circle-outline" label="Void this payment" size={36} bg={colors.surfaceAlt}
            color={colors.muted} onPress={confirmVoid} disabled={busy} />
        )}
      </span>
    </div>
  );
}
