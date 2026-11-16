import { useState, type CSSProperties, type InputHTMLAttributes, type KeyboardEvent } from 'react';
import { colors } from '@/theme';
import { Icon, type IconName } from './icon';
import { Text } from './text';

type Props = Omit<InputHTMLAttributes<HTMLInputElement & HTMLTextAreaElement>, 'onChange' | 'style'> & {
  label?: string;
  icon?: IconName;
  accent?: string;
  error?: string | null;
  value: string;
  onChangeText: (text: string) => void;
  /** Enter in a single-line field (like onSubmitEditing). */
  onSubmit?: () => void;
  multiline?: boolean;
  minHeight?: number;
  style?: CSSProperties;
};

/** Text field with a label and a border that glides to the accent colour on focus. */
export function Input({
  label, icon, accent = colors.primary, error, value, onChangeText, onSubmit, multiline, minHeight, style, ...rest
}: Props) {
  const isPassword = rest.type === 'password';
  const [revealed, setRevealed] = useState(false);
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };
  return (
    <label className="v" style={{ gap: 8, ...style }}>
      {label && <Text variant="label" color={colors.muted}>{label}</Text>}
      <span
        className={`field${error ? ' error' : ''}${multiline ? ' multiline' : ''}`}
        style={{ ['--accent' as string]: accent }}
      >
        {icon && <Icon name={icon} size={18} />}
        {multiline ? (
          <textarea {...rest} value={value} onChange={(e) => onChangeText(e.target.value)} style={{ minHeight: minHeight ?? 80 }} rows={3} />
        ) : (
          <input {...rest} type={isPassword && revealed ? 'text' : rest.type} value={value} onChange={(e) => onChangeText(e.target.value)} onKeyDown={onKeyDown} />
        )}
        {isPassword && !multiline && (
          <button
            type="button"
            className="field-reveal"
            onClick={(e) => { e.preventDefault(); setRevealed((v) => !v); }}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            title={revealed ? 'Hide password' : 'Show password'}
          >
            <Icon name={revealed ? 'eye-off-outline' : 'eye-outline'} size={20} />
          </button>
        )}
      </span>
      {error ? <Text variant="small" color={colors.danger}>{error}</Text> : null}
    </label>
  );
}
