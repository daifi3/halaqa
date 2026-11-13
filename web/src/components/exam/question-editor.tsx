import { ChoiceRow } from '@/components/ui/choice';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { IconButton } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { QUESTION_KINDS, TRUE_FALSE } from '@/lib/exam';
import type { ExamQuestion, ExamQuestionKind } from '@/lib/types';
import { colors, radius } from '@/theme';

const POINTS = [1, 2, 3, 4, 5, 10];
const MAX_OPTIONS = 6;
const LETTERS = 'ABCDEF';

export function blankQuestion(id: string, kind: ExamQuestionKind = 'choice'): ExamQuestion {
  return withKind({ id, kind, prompt: '', options: [], correct: null, points: 1 }, kind);
}

function withKind(q: ExamQuestion, kind: ExamQuestionKind): ExamQuestion {
  if (kind === 'choice') return { ...q, kind, options: q.kind === 'choice' ? q.options : ['', ''], correct: q.kind === 'choice' ? q.correct : 0 };
  if (kind === 'truefalse') return { ...q, kind, options: TRUE_FALSE, correct: 0 };
  return { ...q, kind, options: [], correct: null };
}

/** What's missing before this question can be published, or null when it's complete. */
export function questionProblem(q: ExamQuestion): string | null {
  if (!q.prompt.trim()) return 'Write the question';
  if (q.kind === 'choice' && q.options.some((o) => !o.trim())) return 'Fill in every option, or remove the empty ones';
  return null;
}

function Radio({ on }: { on: boolean }) {
  return (
    <span className="h center" style={{ width: 22, height: 22, borderRadius: 11, border: `2px solid ${on ? colors.success : colors.line}`, backgroundColor: on ? colors.success : 'transparent' }}>
      {on && <Icon name="checkmark" size={14} color="#fff" />}
    </span>
  );
}

export function QuestionEditor({ index, question: q, onChange, onRemove, showError, canRemove }: {
  index: number;
  question: ExamQuestion;
  onChange: (q: ExamQuestion) => void;
  onRemove: () => void;
  /** Only flag problems once the teacher has tried to publish. */
  showError: boolean;
  canRemove: boolean;
}) {
  const problem = showError ? questionProblem(q) : null;
  const setOption = (i: number, text: string) => onChange({ ...q, options: q.options.map((o, j) => (j === i ? text : o)) });
  const removeOption = (i: number) => {
    const options = q.options.filter((_, j) => j !== i);
    const correct = q.correct === i ? 0 : q.correct !== null && q.correct > i ? q.correct - 1 : q.correct;
    onChange({ ...q, options, correct });
  };

  return (
    <div className="v a-down" style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 14, border: `1.5px solid ${problem ? colors.danger : 'transparent'}`, boxShadow: 'var(--shadow-card)' }}>
      <div className="h" style={{ gap: 10 }}>
        <span className="h center" style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.ink }}>
          <Text variant="small" color="#fff" style={{ fontWeight: 700 }}>{index + 1}</Text>
        </span>
        <Text variant="bodyStrong" className="flex1">Question {index + 1}</Text>
        {canRemove && <IconButton icon="trash-outline" size={36} color={colors.danger} bg={colors.dangerSoft} onPress={onRemove} label="Remove question" />}
      </div>

      <div className="h wrap" style={{ gap: 6 }}>
        {(Object.keys(QUESTION_KINDS) as ExamQuestionKind[]).map((kind) => {
          const on = q.kind === kind;
          return (
            <Pressable key={kind} scaleTo={0.94} onClick={() => onChange(withKind(q, kind))} aria-pressed={on}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: radius.pill, backgroundColor: on ? colors.ink : colors.surfaceAlt }}>
              <Icon name={QUESTION_KINDS[kind].icon} size={14} color={on ? '#fff' : colors.inkSoft} />
              <Text variant="small" color={on ? '#fff' : colors.inkSoft}>{QUESTION_KINDS[kind].label}</Text>
            </Pressable>
          );
        })}
      </div>

      <Input value={q.prompt} onChangeText={(prompt) => onChange({ ...q, prompt })} placeholder="Type the question" multiline minHeight={64} />

      {q.kind === 'written' ? (
        <div className="h" style={{ gap: 8, backgroundColor: colors.bg, borderRadius: radius.md, padding: 12 }}>
          <Icon name="information-circle-outline" size={16} color={colors.muted} />
          <Text variant="small" color={colors.muted} className="flex1">Students type a free answer. You grade it after they submit.</Text>
        </div>
      ) : (
        <div className="v" style={{ gap: 8 }}>
          <Text variant="small" color={colors.muted}>Click the circle next to the correct answer</Text>
          {q.options.map((option, i) => (
            <div key={i} className="h a-fade" style={{
              gap: 12, minHeight: 50, padding: '0 14px', borderRadius: radius.md,
              border: `1.5px solid ${q.correct === i ? colors.success : colors.line}`, backgroundColor: q.correct === i ? colors.successSoft : 'transparent',
            }}>
              <Pressable scaleTo={0.85} onClick={() => onChange({ ...q, correct: i })} aria-label={`Mark option ${LETTERS[i]} correct`}>
                <Radio on={q.correct === i} />
              </Pressable>
              {q.kind === 'truefalse' ? (
                <Text variant="bodyStrong" className="flex1">{option}</Text>
              ) : (
                <input
                  value={option}
                  onChange={(e) => setOption(i, e.target.value)}
                  placeholder={`Option ${LETTERS[i]}`}
                  style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', fontSize: 15, padding: '12px 0', color: colors.ink }}
                />
              )}
              {q.kind === 'choice' && q.options.length > 2 && (
                <Pressable scaleTo={0.85} onClick={() => removeOption(i)} aria-label={`Remove option ${LETTERS[i]}`}>
                  <Icon name="close-circle" size={20} color={colors.muted} />
                </Pressable>
              )}
            </div>
          ))}
          {q.kind === 'choice' && q.options.length < MAX_OPTIONS && (
            <Pressable scaleTo={0.96} onClick={() => onChange({ ...q, options: [...q.options, ''] })} style={{ display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start', padding: '6px 4px' }}>
              <Icon name="add" size={16} color={colors.primary} />
              <Text variant="small" color={colors.primary}>Add option</Text>
            </Pressable>
          )}
        </div>
      )}

      <div className="v" style={{ gap: 8 }}>
        <Text variant="small" color={colors.muted}>Points</Text>
        <ChoiceRow wrap options={POINTS.map((p) => ({ value: p, label: String(p) }))} value={q.points} onChange={(points) => onChange({ ...q, points })} />
      </div>

      {problem && (
        <div className="h" style={{ gap: 6 }}>
          <Icon name="alert-circle" size={16} color={colors.danger} />
          <Text variant="small" color={colors.danger}>{problem}</Text>
        </div>
      )}
    </div>
  );
}
