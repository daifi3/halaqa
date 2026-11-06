import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconButton, ToggleRow } from '@/components/ui/misc';
import { Text } from '@/components/ui/text';
import { useNotificationPrefs, type NotificationKey } from '@/store/notification-prefs';
import { useSession } from '@/store/session';
import { colors, radius } from '@/theme';

const TEACHER_ITEMS: { key: NotificationKey; icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { key: 'classReminders', icon: 'calendar-outline', title: 'Class reminders', body: 'Before a session you scheduled starts' },
  { key: 'homeworkDue', icon: 'time-outline', title: 'Homework due soon', body: 'When an assignment deadline is approaching' },
  { key: 'courseInvites', icon: 'mail-outline', title: 'Roster activity', body: 'When a student joins one of your courses' },
  { key: 'documentsShared', icon: 'folder-outline', title: 'Vault activity', body: "When someone opens a document you've shared" },
  { key: 'recordingsReady', icon: 'play-circle-outline', title: 'Recordings ready', body: 'When a class recording finishes processing' },
];

const STUDENT_ITEMS: { key: NotificationKey; icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { key: 'classReminders', icon: 'calendar-outline', title: 'Class reminders', body: 'Before a class you joined starts' },
  { key: 'homeworkAssigned', icon: 'document-text-outline', title: 'New homework', body: 'When a teacher assigns a new homework' },
  { key: 'homeworkDue', icon: 'time-outline', title: 'Homework due soon', body: "When one of your deadlines is approaching" },
  { key: 'courseInvites', icon: 'mail-outline', title: 'Course invites', body: 'When a teacher invites you to a course' },
  { key: 'documentsShared', icon: 'folder-outline', title: 'Shared documents', body: 'When a teacher shares a document with you' },
  { key: 'recordingsReady', icon: 'play-circle-outline', title: 'Recordings ready', body: 'When a recording of a class is ready to watch' },
];

export default function NotificationSettings() {
  const teacher = useSession((s) => s.user?.role === 'teacher');
  const enabled = useNotificationPrefs((s) => s.enabled);
  const setEnabled = useNotificationPrefs((s) => s.setEnabled);
  const prefs = useNotificationPrefs((s) => s.prefs);
  const toggle = useNotificationPrefs((s) => s.toggle);

  const items = teacher ? TEACHER_ITEMS : STUDENT_ITEMS;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => router.back()} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInUp.duration(400)} style={{ gap: 4 }}>
          <Text variant="title">Notifications</Text>
          <Text color={colors.muted}>Choose what Halaqa should notify you about</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60)} style={[styles.row, styles.card]}>
          <View style={[styles.rowIcon, { backgroundColor: colors.ink }]}>
            <Ionicons name="notifications" size={18} color="#fff" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong">Push notifications</Text>
            <Text variant="small" color={colors.muted}>Turn all notifications on or off</Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={setEnabled}
            trackColor={{ false: colors.line, true: colors.primarySoft }}
            thumbColor={enabled ? colors.primary : '#fff'}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120)} style={styles.card}>
          {items.map((item, i) => (
            <View key={item.key}>
              {i > 0 && <View style={styles.sep} />}
              <ToggleRow
                icon={item.icon}
                title={item.title}
                body={item.body}
                value={prefs[item.key]}
                disabled={!enabled}
                onChange={() => toggle(item.key)}
              />
            </View>
          ))}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 8 },
  content: { padding: 20, gap: 20, paddingBottom: 40 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  sep: { height: 1, backgroundColor: colors.line },
});
