import { Icon, type IconName } from '@/components/ui/icon';
import { delay, Switch, ToggleRow } from '@/components/ui/misc';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useNotificationPrefs, type NotificationKey } from '@/store/notification-prefs';
import { useIsTeacher } from '@/store/session';
import { colors, radius } from '@/theme';

type Item = { key: NotificationKey; icon: IconName; title: string; body: string };

const TEACHER_ITEMS: Item[] = [
  { key: 'classReminders', icon: 'calendar-outline', title: 'Class reminders', body: 'Before a session you scheduled starts' },
  { key: 'homeworkDue', icon: 'time-outline', title: 'Homework due soon', body: 'When an assignment deadline is approaching' },
  { key: 'examSubmissions', icon: 'ribbon-outline', title: 'Exam submissions', body: 'When a student finishes one of your exams' },
  { key: 'courseInvites', icon: 'mail-outline', title: 'Roster activity', body: 'When a student joins one of your courses' },
  { key: 'documentsShared', icon: 'folder-outline', title: 'Vault activity', body: "When someone opens a document you've shared" },
  { key: 'recordingsReady', icon: 'play-circle-outline', title: 'Recordings ready', body: 'When a class recording finishes processing' },
];

const STUDENT_ITEMS: Item[] = [
  { key: 'classReminders', icon: 'calendar-outline', title: 'Class reminders', body: 'Before a class you joined starts' },
  { key: 'homeworkAssigned', icon: 'document-text-outline', title: 'New homework', body: 'When a teacher assigns a new homework' },
  { key: 'homeworkDue', icon: 'time-outline', title: 'Homework due soon', body: 'When one of your deadlines is approaching' },
  { key: 'examGrades', icon: 'ribbon-outline', title: 'Exam grades', body: 'When a teacher finalizes your exam grade' },
  { key: 'courseInvites', icon: 'mail-outline', title: 'Course invites', body: 'When a teacher invites you to a course' },
  { key: 'documentsShared', icon: 'folder-outline', title: 'Shared documents', body: 'When a teacher shares a document with you' },
  { key: 'recordingsReady', icon: 'play-circle-outline', title: 'Recordings ready', body: 'When a recording of a class is ready to watch' },
];

export default function NotificationSettings() {
  const teacher = useIsTeacher();
  const enabled = useNotificationPrefs((s) => s.enabled);
  const setEnabled = useNotificationPrefs((s) => s.setEnabled);
  const prefs = useNotificationPrefs((s) => s.prefs);
  const toggle = useNotificationPrefs((s) => s.toggle);
  const items = teacher ? TEACHER_ITEMS : STUDENT_ITEMS;

  return (
    <Screen style={{ gap: 20, paddingBottom: 40 }}>
      <div className="v settings-col" style={{ gap: 20 }}>
      <div className="v a-up split-main" style={{ gap: 4 }}>
        <Text variant="title">Notifications</Text>
        <Text color={colors.muted}>Choose what Halaqa should notify you about</Text>
      </div>

      <div className="split-side">
      <div className="h a-down" style={{ ...delay(60), gap: 12, padding: '14px 16px', backgroundColor: colors.surface, borderRadius: radius.lg }}>
        <span className="h center" style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.ink, flexShrink: 0 }}>
          <Icon name="notifications" size={18} color="#fff" />
        </span>
        <div className="v flex1" style={{ gap: 2 }}>
          <Text variant="bodyStrong">Push notifications</Text>
          <Text variant="small" color={colors.muted}>Turn all notifications on or off</Text>
        </div>
        <Switch value={enabled} onChange={setEnabled} label="Push notifications" />
      </div>
      </div>

      <div className="split-main">

      <div className="a-down" style={{ ...delay(120), backgroundColor: colors.surface, borderRadius: radius.lg, padding: '0 16px' }}>
        {items.map((item, i) => (
          <div key={item.key}>
            {i > 0 && <div style={{ height: 1, backgroundColor: colors.line }} />}
            <ToggleRow icon={item.icon} title={item.title} body={item.body} value={prefs[item.key]} disabled={!enabled} onChange={() => toggle(item.key)} />
          </div>
        ))}
      </div>
      </div>
      </div>
    </Screen>
  );
}
