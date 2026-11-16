import { useEffect, useState, type CSSProperties } from 'react';
import { Icon, type IconName } from '@/components/ui/icon';
import { IconButton, Switch } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { formatClock } from '@/lib/format';
import {
  cleanDraft, emptyDraft, formatDuration, POLL_DURATIONS, POLL_MAX_OPTIONS, POLL_MIN_OPTIONS, POLL_OPTION_MAX,
  POLL_PRESETS, POLL_QUESTION_MAX, type PollDraft,
} from '@/lib/polls';
import { colors, radius } from '@/theme';
import type { Polls, PollView } from './use-polls';

const QUIZ_TINT = '#F5B85C';
const POLL_TINT = '#B9B5FF';

/** Re-renders every half second while a countdown is showing. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

const field: CSSProperties = {
  minHeight: 46, borderRadius: radius.md, backgroundColor: colors.stageCard, color: colors.stageText,
  border: `1px solid ${colors.stageLine}`, padding: '12px 14px', fontSize: 15, fontWeight: 500, outline: 0, width: '100%',
};

function Pill({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable scaleTo={0.94} onClick={onPress} aria-pressed={active} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: radius.pill, flexShrink: 0,
      backgroundColor: active ? colors.primary : colors.stageCard, border: `1px solid ${active ? colors.primary : colors.stageLine}`,
    }}>
      {icon && <Icon name={icon} size={15} color={active ? '#fff' : colors.stageMuted} />}
      <Text variant="small" color={active ? '#fff' : colors.stageText} style={{ fontWeight: 600 }}>{label}</Text>
    </Pressable>
  );
}

/* ---------- Teacher: set up a poll or quiz ---------- */

function Composer({ draft, onChange }: { draft: PollDraft; onChange: (d: PollDraft) => void }) {
  const quiz = draft.kind === 'quiz';
  const set = (patch: Partial<PollDraft>) => onChange({ ...draft, ...patch });
  const setOption = (i: number, text: string) => set({ options: draft.options.map((o, j) => (j === i ? text : o)) });
  const removeOption = (i: number) => set({
    options: draft.options.filter((_, j) => j !== i),
    correct: draft.correct === null ? null : draft.correct === i ? null : draft.correct > i ? draft.correct - 1 : draft.correct,
  });

  return (
    <div className="v" style={{ gap: 18 }}>
      <div className="v" style={{ gap: 10 }}>
        <div className="h" style={{ gap: 8 }}>
          <Pill label="Poll" icon="stats-chart-outline" active={!quiz} onPress={() => set({ kind: 'poll' })} />
          <Pill label="Quiz" icon="school-outline" active={quiz} onPress={() => set({ kind: 'quiz', durationSec: draft.durationSec ?? 60 })} />
        </div>
        <Text variant="small" color={colors.stageMuted}>
          {quiz ? 'A question with one right answer. Students see if they got it right when it ends.' : 'Ask the class’s opinion. There is no right answer.'}
        </Text>
      </div>

      <label className="v" style={{ gap: 8 }}>
        <Text variant="label" color={colors.stageMuted}>Question</Text>
        <textarea
          value={draft.question}
          onChange={(e) => set({ question: e.target.value })}
          placeholder={quiz ? 'e.g. Which keyword creates a new object?' : 'e.g. How are you finding today’s lesson?'}
          maxLength={POLL_QUESTION_MAX}
          rows={2}
          autoFocus
          style={{ ...field, resize: 'vertical', minHeight: 64 }}
        />
      </label>

      <div className="v" style={{ gap: 8 }}>
        <Text variant="label" color={colors.stageMuted}>Answers</Text>
        <div className="h stage-scroll" style={{ gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {POLL_PRESETS.map((p) => (
            <Pill key={p.label} label={p.label} active={false} onPress={() => set({ options: [...p.options], correct: null })} />
          ))}
        </div>
        {draft.options.map((o, i) => (
          <div key={i} className="h" style={{ gap: 10 }}>
            {quiz && (
              <Pressable scaleTo={0.85} onClick={() => set({ correct: i })} aria-label={`Mark option ${i + 1} as the right answer`}
                aria-pressed={draft.correct === i} title="Right answer" style={{ display: 'flex', flexShrink: 0 }}>
                <Icon name={draft.correct === i ? 'checkmark-circle' : 'ellipse-outline'} size={24}
                  color={draft.correct === i ? colors.success : colors.stageMuted} />
              </Pressable>
            )}
            <input
              value={o}
              onChange={(e) => setOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
              maxLength={POLL_OPTION_MAX}
              aria-label={`Option ${i + 1}`}
              style={{ ...field, flex: 1, minWidth: 0, borderColor: quiz && draft.correct === i ? colors.success : colors.stageLine }}
            />
            {draft.options.length > POLL_MIN_OPTIONS && (
              <Pressable scaleTo={0.85} onClick={() => removeOption(i)} aria-label={`Remove option ${i + 1}`} style={{ display: 'flex', flexShrink: 0 }}>
                <Icon name="close-circle" size={22} color={colors.stageMuted} />
              </Pressable>
            )}
          </div>
        ))}
        {draft.options.length < POLL_MAX_OPTIONS && (
          <Pressable scaleTo={0.97} onClick={() => set({ options: [...draft.options, ''] })} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radius.md,
            border: `1px dashed ${colors.stageLine}`, background: 'transparent',
          }}>
            <Icon name="add" size={18} color={colors.stageText} />
            <Text variant="small" color={colors.stageText}>Add an option</Text>
          </Pressable>
        )}
        {quiz && draft.correct === null && (
          <Text variant="small" color={QUIZ_TINT}>Click the circle next to the right answer.</Text>
        )}
      </div>

      <div className="v" style={{ gap: 8 }}>
        <Text variant="label" color={colors.stageMuted}>Timer</Text>
        <div className="h wrap" style={{ gap: 8 }}>
          {POLL_DURATIONS.map((d) => (
            <Pill key={String(d)} label={formatDuration(d)} active={draft.durationSec === d} onPress={() => set({ durationSec: d })} />
          ))}
        </div>
      </div>

      {!quiz && (
        <div className="h" style={{ gap: 12 }}>
          <div className="v flex1" style={{ gap: 2 }}>
            <Text variant="bodyStrong" color={colors.stageText}>Show results while it’s open</Text>
            <Text variant="small" color={colors.stageMuted}>When off, students see results only when you end it.</Text>
          </div>
          <Switch value={draft.showLive} onChange={(showLive) => set({ showLive })} label="Show results while it’s open" />
        </div>
      )}
    </div>
  );
}

/* ---------- The live card: answering, and the results ---------- */

function OptionRow({ text, index, view, mine, onPress, showCount }: {
  text: string;
  index: number;
  view: PollView;
  mine: boolean;
  onPress?: () => void;
  showCount: boolean;
}) {
  const total = view.counts?.reduce((a, b) => a + b, 0) ?? 0;
  const count = view.counts?.[index] ?? 0;
  const pct = total ? Math.round((count / total) * 100) : 0;
  const revealed = view.correct !== null;
  const right = revealed && view.correct === index;
  const wrongPick = revealed && mine && !right && view.phase === 'ended';
  const tint = right ? colors.success : wrongPick ? colors.danger : mine ? colors.primary : colors.stageLine;
  const names = view.voters?.[index] ?? [];

  const inner = (
    <>
      {view.counts && (
        <span aria-hidden style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, transition: 'width 400ms ease',
          backgroundColor: (right ? colors.success : colors.primary) + '33',
        }} />
      )}
      <span className="h" style={{ gap: 10, position: 'relative' }}>
        <Icon
          name={right ? 'checkmark-circle' : wrongPick ? 'close-circle' : mine ? 'radio-button-on' : 'radio-button-off'}
          size={20}
          color={right ? colors.success : wrongPick ? colors.danger : mine ? colors.primary : colors.stageMuted}
        />
        <Text color={colors.stageText} className="flex1" style={{ textAlign: 'left' }}>{text}</Text>
        {view.counts && showCount && (
          <Text variant="small" color={colors.stageText} style={{ fontWeight: 600 }}>{pct}% · {count}</Text>
        )}
      </span>
      {names.length > 0 && (
        <Text variant="small" color={colors.stageMuted} lines={2} style={{ position: 'relative', marginLeft: 30, textAlign: 'left' }}>{names.join(', ')}</Text>
      )}
    </>
  );
  const style: CSSProperties = {
    position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 4, width: '100%',
    borderRadius: radius.md, border: `1.5px solid ${tint}`, padding: '12px 14px',
    backgroundColor: mine && !revealed ? colors.primary + '22' : colors.stageCard,
  };
  return onPress
    ? <Pressable scaleTo={0.98} onClick={onPress} role="radio" aria-checked={mine} style={style}>{inner}</Pressable>
    : <div style={style}>{inner}</div>;
}

function PollCard({ polls, isTeacher, studentCount }: { polls: Polls; isTeacher: boolean; studentCount: number }) {
  const view = polls.view!;
  const open = view.phase === 'open';
  const now = useNow(open && view.deadline !== null);
  const left = view.deadline === null ? null : Math.max(0, Math.ceil((view.deadline - now) / 1000));
  const closing = open && left === 0;
  const canVote = !isTeacher && open && !closing;
  const quiz = view.poll.kind === 'quiz';
  const mine = polls.myChoice;

  let feedback: { icon: IconName; text: string; tint: string } | null = null;
  if (!isTeacher && !open && quiz && view.correct !== null) {
    feedback = mine === null
      ? { icon: 'remove-circle', text: `You didn’t answer. The right answer was “${view.poll.options[view.correct]}”.`, tint: colors.stageMuted }
      : mine === view.correct
        ? { icon: 'trophy', text: 'Correct! Well done.', tint: colors.success }
        : { icon: 'close-circle', text: `Not quite. The right answer was “${view.poll.options[view.correct]}”.`, tint: colors.danger };
  }

  const chip = (bg: string): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: radius.pill, backgroundColor: bg });

  return (
    <div className="v" style={{ gap: 14 }}>
      <div className="h" style={{ gap: 8 }}>
        <span style={chip(quiz ? '#3A2E14' : '#24234A')}>
          <Icon name={quiz ? 'school' : 'stats-chart'} size={12} color={quiz ? QUIZ_TINT : POLL_TINT} />
          <Text variant="small" color={quiz ? QUIZ_TINT : POLL_TINT} style={{ fontWeight: 600 }}>{quiz ? 'Quiz' : 'Poll'}</Text>
        </span>
        <span className="flex1" />
        {open ? (
          left !== null ? (
            <span style={chip(left <= 10 ? colors.danger + '33' : colors.stageLine)} aria-live="off">
              <Icon name="timer-outline" size={13} color={left <= 10 ? colors.danger : colors.stageText} />
              <Text variant="small" color={left <= 10 ? colors.danger : colors.stageText} style={{ fontWeight: 600 }}>{formatClock(left)}</Text>
            </span>
          ) : (
            <Text variant="small" color={colors.success} style={{ fontWeight: 600 }}>Open</Text>
          )
        ) : (
          <Text variant="small" color={colors.stageMuted} style={{ fontWeight: 600 }}>Ended</Text>
        )}
      </div>

      <Text variant="heading" color={colors.stageText}>{view.poll.question}</Text>

      <div className="v" role="radiogroup" aria-label={view.poll.question} style={{ gap: 8 }}>
        {view.poll.options.map((o, i) => (
          <OptionRow
            key={i}
            text={o}
            index={i}
            view={view}
            mine={!isTeacher && mine === i}
            onPress={canVote ? () => polls.vote(i) : undefined}
            showCount={isTeacher || !open || view.poll.showLive}
          />
        ))}
      </div>

      {feedback ? (
        <div className="h a-fade" role="status" style={{ gap: 10, padding: 12, borderRadius: radius.md, border: `1px solid ${feedback.tint}`, backgroundColor: colors.stageCard }}>
          <Icon name={feedback.icon} size={20} color={feedback.tint} />
          <Text variant="bodyStrong" color={colors.stageText} className="flex1">{feedback.text}</Text>
        </div>
      ) : (
        <Text variant="small" color={colors.stageMuted}>
          {isTeacher
            ? `${view.answered} of ${studentCount} ${studentCount === 1 ? 'student' : 'students'} answered`
            : open
              ? mine === null
                ? closing ? 'Time’s up.' : 'Pick an answer. You can change it until the poll closes.'
                : 'Answer sent. You can change it until the poll closes.'
              : `${view.answered} ${view.answered === 1 ? 'person' : 'people'} answered`}
          {isTeacher && quiz && open ? ' · only you can see the right answer' : ''}
        </Text>
      )}
    </div>
  );
}

/* ---------- The sheet ---------- */

function Action({ label, icon, onPress, secondary, disabled, grow }: {
  label: string; icon?: IconName; onPress: () => void; secondary?: boolean; disabled?: boolean; grow?: boolean;
}) {
  return (
    <Pressable scaleTo={0.97} onClick={onPress} disabled={disabled} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, padding: '0 18px', borderRadius: radius.md,
      backgroundColor: secondary ? colors.stageLine : colors.primary, flex: grow ? 1 : undefined,
    }}>
      {icon && <Icon name={icon} size={17} color="#fff" />}
      <Text variant="bodyStrong" color={secondary ? colors.stageText : '#fff'}>{label}</Text>
    </Pressable>
  );
}

/** Polls and quizzes: a sheet from the bottom on phones, a panel on the right on wide screens. */
export function PollPanel({ polls, isTeacher, studentCount }: { polls: Polls; isTeacher: boolean; studentCount: number }) {
  const composing = polls.composing;
  const view = polls.view;
  const ready = !!cleanDraft(polls.draft);
  const { hide } = polls;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hide]);

  const title = composing ? 'New poll or quiz' : view?.phase === 'ended' ? 'Results' : view?.poll.kind === 'quiz' ? 'Quiz' : 'Poll';
  const subtitle = composing ? 'Students answer from their screen' : isTeacher ? 'Only you see who picked what' : 'From your teacher';

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 20 }}>
      <div className="a-fade" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)' }} onClick={polls.hide} aria-hidden />
      <div className="poll-sheet" role="dialog" aria-label={title}>
        <div className="h" style={{ gap: 12, padding: '18px 20px 12px', borderBottom: `1px solid ${colors.stageLine}` }}>
          <div className="v flex1">
            <Text variant="heading" color={colors.stageText}>{title}</Text>
            <Text variant="small" color={colors.stageMuted}>{subtitle}</Text>
          </div>
          <IconButton icon="close" size={38} color={colors.stageText} bg={colors.stageCard} onPress={polls.hide} label="Close polls" />
        </div>

        <div className="v stage-scroll" style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: 20 }}>
          {composing ? (
            <Composer draft={polls.draft} onChange={polls.setDraft} />
          ) : view ? (
            <PollCard polls={polls} isTeacher={isTeacher} studentCount={studentCount} />
          ) : (
            <div className="v center" style={{ gap: 10, padding: '32px 0' }}>
              <Icon name="stats-chart-outline" size={30} color={colors.stageMuted} />
              <Text color={colors.stageMuted}>No poll right now.</Text>
            </div>
          )}
        </div>

        {isTeacher && (
          <div className="h" style={{ gap: 10, padding: '12px 20px max(env(safe-area-inset-bottom), 14px)', borderTop: `1px solid ${colors.stageLine}` }}>
            {composing ? (
              <>
                {view && <Action secondary label="Back" onPress={polls.cancelCompose} />}
                {!view && polls.draft.question.length > 0 && (
                  <Action secondary label="Clear" onPress={() => polls.setDraft(emptyDraft(polls.draft.kind))} />
                )}
                <Action grow icon="send" label={polls.draft.kind === 'quiz' ? 'Start quiz' : 'Start poll'} disabled={!ready} onPress={polls.start} />
              </>
            ) : view?.phase === 'open' ? (
              <Action grow icon="flag" label={view.poll.kind === 'quiz' ? 'End and reveal the answer' : 'End and show results'} onPress={polls.end} />
            ) : (
              <>
                <Action secondary label="Close for all" onPress={polls.clear} />
                <Action grow icon="add" label="New poll" onPress={polls.compose} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
