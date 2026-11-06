import type Ionicons from '@expo/vector-icons/Ionicons';
import type { RsvpStatus } from './types';
import { colors } from '@/theme';

/** One look per RSVP state, shared by the student's invite card and the teacher's list. */
export const RSVP_STYLE: Record<RsvpStatus, { label: string; icon: keyof typeof Ionicons.glyphMap; fg: string; bg: string }> = {
  accepted: { label: 'Accepted', icon: 'checkmark-circle', fg: colors.success, bg: colors.successSoft },
  pending: { label: 'Pending', icon: 'time-outline', fg: colors.inkSoft, bg: colors.surfaceAlt },
  declined: { label: 'Declined', icon: 'close-circle', fg: colors.danger, bg: colors.dangerSoft },
};
