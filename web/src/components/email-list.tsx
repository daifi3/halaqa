import { colors, radius } from '@/theme';
import { Icon } from './ui/icon';
import { Input } from './ui/input';
import { Avatar, IconButton } from './ui/misc';
import { Pressable } from './ui/pressable';
import { Text } from './ui/text';

/** Email field with the black "+" button next to it. */
export function EmailAdder({ value, onChange, onAdd, placeholder = 'student@email.com', error }: {
  value: string; onChange: (v: string) => void; onAdd: () => void; placeholder?: string; error?: string | null;
}) {
  return (
    <div className="h" style={{ gap: 8, alignItems: 'flex-start' }}>
      <Input
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        icon="mail-outline"
        type="email"
        autoComplete="off"
        onSubmit={onAdd}
        error={error}
        style={{ flex: 1, minWidth: 0 }}
      />
      <IconButton icon="add" onPress={onAdd} bg={colors.ink} color="#fff" size={54} label="Add email" />
    </div>
  );
}

/** Removable email pills under a form's email field. */
export function EmailChips({ emails, onRemove }: { emails: string[]; onRemove: (e: string) => void }) {
  if (!emails.length) return null;
  return (
    <div className="h wrap" style={{ gap: 8 }}>
      {emails.map((e) => (
        <Pressable
          key={e}
          className="a-zoom"
          onClick={() => onRemove(e)}
          aria-label={`Remove ${e}`}
          style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: colors.primarySoft, padding: '8px 8px 8px 12px', borderRadius: radius.pill }}
        >
          <Text variant="small" color={colors.primary}>{e}</Text>
          <Icon name="close-circle" size={16} color={colors.primary} />
        </Pressable>
      ))}
    </div>
  );
}

/** A roster / share list row: avatar, email, and an optional trailing control. */
export function EmailRow({ email, trailing }: { email: string; trailing?: React.ReactNode }) {
  return (
    <div className="h a-zoom" style={{ gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, padding: 10 }}>
      <Avatar name={email} size={32} />
      <Text className="flex1" lines={1}>{email}</Text>
      {trailing}
    </div>
  );
}
