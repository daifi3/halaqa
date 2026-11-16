import { Tabs } from 'expo-router/js-tabs';
import { TabBar } from '@/components/tab-bar';
import { useNotifications } from '@/lib/push';
import { useChatRealtime } from '@/lib/use-chat-realtime';
import { useIncomingCalls } from '@/lib/use-incoming-calls';
import { colors } from '@/theme';

export default function TabsLayout() {
  // Signed in: keep the bell fresh, register for pushes, open tapped notifications.
  useNotifications();
  // Someone calling you while the app is open.
  useIncomingCalls();
  // Live chat messages, typing and reactions, over LiveKit.
  useChatRealtime();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg }, animation: 'shift' }}
    >
      <Tabs.Screen name="index" options={{ title: 'Classes' }} />
      <Tabs.Screen name="courses" options={{ title: 'Courses' }} />
      <Tabs.Screen name="exams" options={{ title: 'Exams' }} />
      <Tabs.Screen name="recordings" options={{ title: 'Recordings' }} />
      <Tabs.Screen name="contacts" options={{ title: 'Contacts' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
