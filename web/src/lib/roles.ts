import type { IconName } from '@/components/ui/icon';
import type { Role } from '@/lib/types';
import { colors } from '@/theme';

/** How each role is named and coloured everywhere (sidebar, profile, the admin's user list). */
export const ROLES: Record<Role, { label: string; tone: string; soft: string; icon: IconName; hint: string }> = {
  teacher: { label: 'Teacher', tone: colors.teacher, soft: colors.teacherSoft, icon: 'school', hint: 'Runs courses, classes and exams' },
  student: { label: 'Student', tone: colors.student, soft: colors.studentSoft, icon: 'book', hint: 'Joins classes, hands in work' },
  admin: { label: 'Admin', tone: colors.success, soft: colors.successSoft, icon: 'shield-checkmark', hint: 'Creates accounts and assigns roles' },
};

export const ROLE_ORDER: Role[] = ['teacher', 'student', 'admin'];
