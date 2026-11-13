import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { delay } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { AuthArt, FloatingHero } from '@/components/auth-art';
import type { Role } from '@/lib/types';
import { colors, radius } from '@/theme';

function RoleCard({ role, selected, onPress, delayMs }: { role: Role; selected: boolean; onPress: () => void; delayMs: number }) {
  const tone = role === 'teacher' ? colors.teacher : colors.student;
  const soft = role === 'teacher' ? colors.teacherSoft : colors.studentSoft;
  return (
    <div className="flex1 a-down" style={delay(delayMs)}>
      <Pressable
        onClick={onPress}
        scaleTo={0.95}
        aria-pressed={selected}
        style={{
          position: 'relative', width: '100%', height: '100%', backgroundColor: colors.surface, borderRadius: radius.lg,
          border: `2px solid ${selected ? tone : colors.line}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 8,
          minHeight: 170, transform: selected ? 'translateY(-4px)' : undefined,
        }}
      >
        <span className="h center" style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: soft, marginBottom: 4 }}>
          <Icon name={role === 'teacher' ? 'school' : 'book'} size={22} color={tone} />
        </span>
        <Text variant="heading">{role === 'teacher' ? 'I teach' : 'I learn'}</Text>
        <Text variant="small" color={colors.muted}>
          {role === 'teacher' ? 'Reserve rooms, invite students, record lessons.' : 'Join classes, follow the board, replay lessons.'}
        </Text>
        <span
          className="h center"
          style={{
            position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderRadius: 12, backgroundColor: tone,
            opacity: selected ? 1 : 0, transform: `scale(${selected ? 1 : 0.4})`, transition: 'all 300ms var(--spring)',
          }}
        >
          <Icon name="checkmark" size={14} color="#fff" />
        </span>
      </Pressable>
    </div>
  );
}

export default function Welcome() {
  const [role, setRole] = useState<Role | null>(null);
  const navigate = useNavigate();
  const { state } = useLocation();

  return (
    <div className="page auth">
      <AuthArt />
      <div className="content narrow auth-form" style={{ flex: 1, padding: '12px 24px', justifyContent: 'space-between', gap: 24 }}>
        <div className="auth-hero-inline"><FloatingHero /></div>
        <div className="v a-up" style={{ ...delay(100), gap: 10 }}>
          <Text variant="label" color={colors.primary}>Halaqa</Text>
          <Text variant="display">Classrooms that<br />feel close.</Text>
          <Text color={colors.muted}>Live video, a shared whiteboard and recorded lessons — in one calm place.</Text>
        </div>

        <div className="h" style={{ gap: 12, alignItems: 'stretch' }}>
          <RoleCard role="teacher" selected={role === 'teacher'} onPress={() => setRole('teacher')} delayMs={250} />
          <RoleCard role="student" selected={role === 'student'} onPress={() => setRole('student')} delayMs={330} />
        </div>

        <div className="v a-up" style={{ ...delay(450), gap: 16, paddingBottom: 12 }}>
          <Button
            title="Continue"
            icon="arrow-forward"
            disabled={!role}
            accent={role === 'student' ? colors.student : role === 'teacher' ? colors.teacher : undefined}
            onPress={() => role && navigate(`/sign-up?role=${role}`, { state })}
          />
          <Pressable onClick={() => navigate('/log-in', { state })} style={{ alignSelf: 'center' }}>
            <Text color={colors.muted}>Already have an account? <Text color={colors.primary} variant="bodyStrong">Log in</Text></Text>
          </Pressable>
        </div>
      </div>
    </div>
  );
}
