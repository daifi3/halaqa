import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { ChoiceRow } from '@/components/ui/choice';
import { Input } from '@/components/ui/input';
import { IconButton } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { QUESTION_KINDS, TRUE_FALSE } from '@/lib/exam';
import type { ExamQuestion, ExamQuestionKind } from '@/lib/types';
import { colors, fonts, radius, shadow } from '@/theme';

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
    <View style={[styles.radio, on && styles.radioOn]}>
      {on && <Ionicons name="checkmark" size={14} color="#fff" />}
    </View>
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
    <Animated.View entering={FadeInDown} layout={LinearTransition.springify()} style={[styles.card, problem && styles.cardError]}>
      <View style={styles.head}>
        <View style={styles.number}>
          <Text variant="small" color="#fff" style={{ fontFamily: fonts.bold }}>{index + 1}</Text>
        </View>
        <Text variant="bodyStrong" style={{ flex: 1 }}>Question {index + 1}</Text>
        {canRemove && <IconButton icon="trash-outline" size={36} color={colors.danger} bg={colors.dangerSoft} onPress={onRemove} />}
      </View>

      <View style={styles.kinds}>
        {(Object.keys(QUESTION_KINDS) as ExamQuestionKind[]).map((kind) => {
          const on = q.kind === kind;
          return (
            <PressableScale key={kind} scaleTo={0.94} onPress={() => onChange(withKind(q, kind))} style={[styles.kind, on && styles.kindOn]}>
              <Ionicons name={QUESTION_KINDS[kind].icon} size={14} color={on ? '#fff' : colors.inkSoft} />
              <Text variant="small" color={on ? '#fff' : colors.inkSoft}>{QUESTION_KINDS[kind].label}</Text>
            </PressableScale>
          );
        })}
      </View>

      <Input
        value={q.prompt}
        onChangeText={(prompt) => onChange({ ...q, prompt })}
        placeholder="Type the question"
        multiline
        style={{ minHeight: 64, textAlignVertical: 'top', paddingTop: 14 }}
      />

      {q.kind === 'written' ? (
        <View style={styles.hint}>
          <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
          <Text variant="small" color={colors.muted} style={{ flex: 1 }}>Students type a free answer. You grade it after they submit.</Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Text variant="small" color={colors.muted}>Tap the circle next to the correct answer</Text>
          {q.options.map((option, i) => (
            <Animated.View key={i} entering={FadeIn} layout={LinearTransition.springify()} style={[styles.option, q.correct === i && styles.optionOn]}>
              <PressableScale scaleTo={0.85} onPress={() => onChange({ ...q, correct: i })} hitSlop={8}>
                <Radio on={q.correct === i} />
              </PressableScale>
              {q.kind === 'truefalse' ? (
                <Text variant="bodyStrong" style={{ flex: 1 }}>{option}</Text>
              ) : (
                <TextInput
                  value={option}
                  onChangeText={(t) => setOption(i, t)}
                  placeholder={`Option ${LETTERS[i]}`}
                  placeholderTextColor={colors.muted}
                  selectionColor={colors.primary}
                  style={styles.optionInput}
                />
              )}
              {q.kind === 'choice' && q.options.length > 2 && (
                <PressableScale scaleTo={0.85} onPress={() => removeOption(i)} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={colors.muted} />
                </PressableScale>
              )}
            </Animated.View>
          ))}
          {q.kind === 'choice' && q.options.length < MAX_OPTIONS && (
            <PressableScale scaleTo={0.96} onPress={() => onChange({ ...q, options: [...q.options, ''] })} style={styles.addOption}>
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text variant="small" color={colors.primary}>Add option</Text>
            </PressableScale>
          )}
        </View>
      )}

      <View style={{ gap: 8 }}>
        <Text variant="small" color={colors.muted}>Points</Text>
        <ChoiceRow wrap options={POINTS.map((p) => ({ value: p, label: String(p) }))} value={q.points} onChange={(points) => onChange({ ...q, points })} />
      </View>

      {problem && (
        <View style={styles.error}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <Text variant="small" color={colors.danger}>{problem}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 14, borderWidth: 1.5, borderColor: 'transparent', ...shadow.card },
  cardError: { borderColor: colors.danger },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  number: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  kind: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.pill, backgroundColor: colors.surfaceAlt,
  },
  kindOn: { backgroundColor: colors.ink },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.bg, borderRadius: radius.md, padding: 12 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingHorizontal: 14,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line,
  },
  optionOn: { borderColor: colors.success, backgroundColor: colors.successSoft },
  optionInput: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink, paddingVertical: 12 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: colors.success, borderColor: colors.success },
  addOption: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 4 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
