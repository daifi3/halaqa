import Ionicons from '@expo/vector-icons/Ionicons';
import { router, usePathname, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, BackHandler, PanResponder, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInLeft, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';
import { totalUnread, useChats } from '@/store/chats';
import { useInbox } from '@/store/inbox';
import { useSession } from '@/store/session';
import { useSideMenu } from '@/store/side-menu';
import { colors, radius, shadow } from '@/theme';
import { Avatar } from './ui/misc';
import { PressableScale } from './ui/pressable-scale';
import { Text } from './ui/text';

type IconName = keyof typeof Ionicons.glyphMap;

interface Item {
  label: string;
  icon: IconName;
  href: Href;
  /** Paths that count as "here" for the highlight. */
  match: RegExp;
  hint?: string;
  badge?: number;
  /** Tint of the icon tile. */
  tone?: string;
}

interface Section { title: string; items: Item[] }

const OPEN_SPRING = { damping: 22, stiffness: 220, mass: 0.9 };

/** ☰ button for a tab's header. */
export function MenuButton() {
  const show = useSideMenu((s) => s.show);
  return (
    <PressableScale onPress={show} scaleTo={0.9} accessibilityRole="button" accessibilityLabel="Open menu" style={styles.menuButton}>
      <View style={{ gap: 4, alignItems: 'flex-start' }}>
        <View style={[styles.bar, { width: 18 }]} />
        <View style={[styles.bar, { width: 12 }]} />
        <View style={[styles.bar, { width: 15 }]} />
      </View>
    </PressableScale>
  );
}

function MenuRow({ item, active, index, onPress }: { item: Item; active: boolean; index: number; onPress: () => void }) {
  const tone = item.tone ?? colors.primary;
  return (
    <Animated.View entering={FadeInLeft.delay(80 + index * 35).springify().damping(18)}>
      <PressableScale
        onPress={onPress}
        scaleTo={0.97}
        accessibilityRole="menuitem"
        accessibilityState={{ selected: active }}
        style={[styles.row, active && { backgroundColor: colors.primarySoft }]}
      >
        {active && <View style={styles.activeBar} />}
        <View style={[styles.rowIcon, { backgroundColor: active ? tone : tone + '1F' }]}>
          <Ionicons name={item.icon} size={18} color={active ? '#fff' : tone} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" color={active ? colors.primary : colors.ink} numberOfLines={1}>{item.label}</Text>
          {item.hint && <Text variant="small" color={colors.muted} numberOfLines={1}>{item.hint}</Text>}
        </View>
        {!!item.badge && (
          <View style={[styles.badge, { backgroundColor: active ? colors.primary : colors.inverse }]}>
            <Text style={styles.badgeText} color="#fff">{item.badge > 99 ? '99+' : item.badge}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={active ? colors.primary : colors.line} />
      </PressableScale>
    </Animated.View>
  );
}

/**
 * The app's side menu: a panel that springs in from the left over a dimmed backdrop.
 * Close it by tapping outside, swiping it left, Android's back button, or picking an item.
 * Teachers get their teaching tools (students, courses, exams…); students their learning ones.
 */
export function SideMenu() {
  const me = useSession((s) => s.user);
  return me ? <Menu me={me} /> : null;
}

function Menu({ me }: { me: User }) {
  const { open, openCount, hide } = useSideMenu();
  const teacher = me.role === 'teacher';
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const width = Math.min(screenW * 0.84, 340);
  const pathname = usePathname();
  const unreadChats = useChats((s) => totalUnread(s.conversations));
  const unreadInbox = useInbox((s) => s.unread);
  const [studentCount, setStudentCount] = useState<number | undefined>();

  // 0 = closed, 1 = open. Driven by the spring, and directly by the finger while swiping.
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(open ? withSpring(1, OPEN_SPRING) : withTiming(0, { duration: 220 }));
  }, [open, progress]);

  // Fresh student count each time a teacher opens the menu.
  useEffect(() => {
    if (!open || !teacher) return;
    let live = true;
    api.listMyStudents().then((s) => live && setStudentCount(s.length)).catch(() => {});
    return () => { live = false; };
  }, [open, teacher]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { hide(); return true; });
    return () => sub.remove();
  }, [open, hide]);

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dx < -8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: (_, g) => progress.set(Math.max(0, Math.min(1, 1 + g.dx / width))),
    onPanResponderRelease: (_, g) => {
      if (g.dx < -width * 0.3 || g.vx < -0.5) hide();
      else progress.set(withSpring(1, OPEN_SPRING));
    },
    onPanResponderTerminate: () => progress.set(withSpring(1, OPEN_SPRING)),
  }), [width, progress, hide]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.get(), [0, 1], [-width - 24, 0]) }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));

  const sections: Section[] = teacher
    ? [
      {
        title: 'Teaching',
        items: [
          { label: 'Students', icon: 'school', href: '/students', match: /^\/students/, hint: 'Everyone across your courses', badge: studentCount, tone: colors.teacher },
          { label: 'Classes', icon: 'grid', href: '/', match: /^\/$|^\/room/, hint: 'Live and upcoming sessions', tone: colors.teacher },
          { label: 'Courses', icon: 'library', href: '/courses', match: /^\/course/, hint: 'Rosters, homework', tone: colors.teacher },
          { label: 'Exams', icon: 'ribbon', href: '/exams', match: /^\/exam/, hint: 'Create and grade', tone: colors.teacher },
          { label: 'Recordings', icon: 'play-circle', href: '/recordings', match: /^\/recording/, tone: colors.teacher },
          { label: 'Documents', icon: 'folder-open', href: '/vault', match: /^\/vault/, hint: 'Your vault', tone: colors.teacher },
        ],
      },
      {
        title: 'Quick actions',
        items: [
          { label: 'Reserve a room', icon: 'add-circle', href: '/room/new', match: /^\/room\/new/, tone: colors.success },
          { label: 'New course', icon: 'add', href: '/course/new', match: /^\/course\/new/, tone: colors.success },
        ],
      },
    ]
    : [
      {
        title: 'Learning',
        items: [
          { label: 'Classes', icon: 'grid', href: '/', match: /^\/$|^\/room/, hint: 'Your invitations', tone: colors.student },
          { label: 'Courses', icon: 'library', href: '/courses', match: /^\/course/, hint: 'Homework and sessions', tone: colors.student },
          { label: 'Exams', icon: 'ribbon', href: '/exams', match: /^\/exam/, tone: colors.student },
          { label: 'Recordings', icon: 'play-circle', href: '/recordings', match: /^\/recording/, tone: colors.student },
          { label: 'Documents', icon: 'folder-open', href: '/vault', match: /^\/vault/, hint: 'Shared with you', tone: colors.student },
        ],
      },
      {
        title: 'Quick actions',
        items: [
          { label: 'Join with a code', icon: 'keypad', href: '/join', match: /^\/join/, tone: colors.success },
          { label: 'Scan a QR code', icon: 'qr-code', href: '/scan', match: /^\/scan/, tone: colors.success },
        ],
      },
    ];
  sections.push(
    {
      title: 'Connect',
      items: [
        { label: 'Contacts & chats', icon: 'chatbubbles', href: '/contacts', match: /^\/(contact|chat)/, badge: unreadChats },
        { label: 'Notifications', icon: 'notifications', href: '/inbox', match: /^\/(inbox|notifications)/, badge: unreadInbox },
      ],
    },
    {
      title: 'Account',
      items: [
        { label: 'Profile & settings', icon: 'person-circle', href: '/profile', match: /^\/profile/, tone: colors.inkSoft },
        { label: 'Change password', icon: 'key', href: '/change-password', match: /^\/change-password/, tone: colors.inkSoft },
      ],
    },
  );

  const go = (href: Href) => {
    hide();
    // Let the panel start leaving before the next screen slides in.
    setTimeout(() => router.navigate(href), 120);
  };

  const signOut = () =>
    Alert.alert('Sign out?', 'You can sign back in at any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { hide(); void api.signOut(); } },
    ]);

  const tone = teacher ? colors.teacher : colors.student;
  let index = 0;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'} accessibilityViewIsModal={open}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={hide} accessibilityLabel="Close menu" />
      </Animated.View>

      <Animated.View
        {...pan.panHandlers}
        style={[styles.panel, { width, paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) }, panelStyle]}
      >
        {/* Who's signed in */}
        <View style={styles.hero}>
          <View style={[styles.heroGlow, { backgroundColor: tone }]} />
          <View style={styles.heroTop}>
            <Avatar name={me.name} size={52} ring={tone} uri={me.avatarUrl} />
            <PressableScale onPress={hide} scaleTo={0.85} style={styles.close} accessibilityLabel="Close menu">
              <Ionicons name="close" size={18} color="#fff" />
            </PressableScale>
          </View>
          <View style={{ gap: 2 }}>
            <Text variant="heading" color="#fff" numberOfLines={1}>{me.name}</Text>
            <Text variant="small" color="rgba(255,255,255,0.6)" numberOfLines={1}>{me.email}</Text>
          </View>
          <View style={[styles.rolePill, { backgroundColor: tone }]}>
            <Ionicons name={teacher ? 'easel' : 'school'} size={12} color="#fff" />
            <Text style={styles.roleText} color="#fff">{teacher ? 'Teacher' : 'Student'}</Text>
          </View>
        </View>

        <ScrollView key={openCount} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {sections.map((section) => (
            <View key={section.title} style={{ gap: 2 }}>
              <Text variant="label" color={colors.muted} style={styles.sectionTitle}>{section.title}</Text>
              {section.items.map((item) => (
                <MenuRow
                  key={item.label}
                  item={item}
                  index={index++}
                  active={item.match.test(pathname)}
                  onPress={() => go(item.href)}
                />
              ))}
            </View>
          ))}
        </ScrollView>

        <PressableScale onPress={signOut} scaleTo={0.97} style={styles.signOut}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text variant="bodyStrong" color={colors.danger}>Sign out</Text>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  menuButton: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', ...shadow.card,
  },
  bar: { height: 2.5, borderRadius: 2, backgroundColor: colors.ink },
  backdrop: { backgroundColor: 'rgba(10,10,18,0.45)' },
  panel: {
    position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: colors.bg,
    borderTopRightRadius: radius.xl, borderBottomRightRadius: radius.xl, paddingHorizontal: 14, gap: 12,
    ...shadow.float,
  },
  hero: {
    backgroundColor: colors.inverse, borderRadius: radius.xl, padding: 16, gap: 12, overflow: 'hidden',
  },
  heroGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -70, top: -80, opacity: 0.35 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  close: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center',
  },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill,
  },
  roleText: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.4 },
  list: { gap: 16, paddingBottom: 8 },
  sectionTitle: { paddingHorizontal: 10, marginBottom: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingHorizontal: 10,
    borderRadius: radius.md, overflow: 'hidden',
  },
  activeBar: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2, backgroundColor: colors.primary },
  rowIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
  signOut: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13,
    borderRadius: radius.md, backgroundColor: colors.dangerSoft,
  },
});
