import { Suspense } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { ROLES } from '@/lib/roles';
import type { Role } from '@/lib/types';
import { useMe } from '@/store/session';
import { useIncomingCalls } from '@/lib/use-calls';
import { useChatRealtime } from '@/lib/use-chat-realtime';
import { ChatWidget } from './chat/chat-widget';
import { InboxToasts, SidebarInboxLink, useInboxPolling } from './inbox';
import { colors } from '@/theme';
import { Icon, type IconName } from './ui/icon';
import { Avatar, Spinner } from './ui/misc';
import { Text } from './ui/text';

type Tab = { path: string; label: string; on: IconName; off: IconName };

export const TABS: Tab[] = [
  { path: '/', label: 'Classes', on: 'grid', off: 'grid-outline' },
  { path: '/courses', label: 'Courses', on: 'library', off: 'library-outline' },
  { path: '/exams', label: 'Exams', on: 'ribbon', off: 'ribbon-outline' },
  { path: '/recordings', label: 'Recordings', on: 'play-circle', off: 'play-circle-outline' },
  { path: '/contacts', label: 'Contacts', on: 'people', off: 'people-outline' },
  { path: '/profile', label: 'Profile', on: 'person-circle', off: 'person-circle-outline' },
];

/** Halaqa admins manage accounts; they don't teach or take classes. */
const ADMIN_TABS: Tab[] = [
  { path: '/admin/users', label: 'Users', on: 'people', off: 'people-outline' },
  { path: '/admin/requests', label: 'Demo requests', on: 'mail-unread', off: 'mail-unread-outline' },
  { path: '/admin/payments', label: 'Payments', on: 'card', off: 'card-outline' },
  { path: '/profile', label: 'Profile', on: 'person-circle', off: 'person-circle-outline' },
];

export const tabsFor = (role: Role) => (role === 'admin' ? ADMIN_TABS : TABS);

function adminSectionOf(pathname: string) {
  if (/^\/admin\/users\b/.test(pathname)) return 0;
  if (/^\/admin\/requests\b/.test(pathname)) return 1;
  if (/^\/admin\/payments\b/.test(pathname)) return 2;
  if (/^\/(profile|notifications|change-password)\b/.test(pathname)) return 3;
  return -1;
}

/** Which tab a page belongs to, so the sidebar keeps its place on pages opened from a tab. */
function sectionOf(pathname: string) {
  if (pathname === '/' || /^\/(room|join)\b/.test(pathname)) return 0;
  if (/^\/(courses|course|homework)\b/.test(pathname)) return 1;
  if (/^\/(exams|exam)\b/.test(pathname)) return 2;
  if (/^\/recordings\b/.test(pathname)) return 3;
  if (/^\/(contacts|contact)\b/.test(pathname)) return 4;
  if (/^\/(profile|vault|notifications|change-password)\b/.test(pathname)) return 5;
  return -1;
}

function Account() {
  const me = useMe();
  const role = ROLES[me.role];
  const tone = role.tone;
  return (
    <Link to="/profile" className="sidebar-account press">
      <Avatar name={me.name} size={38} ring={tone} uri={me.avatarUrl} />
      <span className="v flex1" style={{ minWidth: 0 }}>
        <Text variant="bodyStrong" lines={1}>{me.name}</Text>
        <Text variant="small" color={colors.muted}>{role.label}</Text>
      </span>
    </Link>
  );
}

/**
 * The signed-in app around every page. Phones: the floating pill tab bar, on the tabs only,
 * with an indicator that springs between tabs. Desktop: a sidebar on every page.
 */
export function TabsLayout() {
  const { pathname } = useLocation();
  const me = useMe();
  const tabs = tabsFor(me.role);
  const section = me.role === 'admin' ? adminSectionOf(pathname) : sectionOf(pathname);
  const onTab = tabs.some((t) => t.path === pathname);
  const index = Math.max(0, section);
  useInboxPolling();
  // Someone calling you while the site is open.
  useIncomingCalls();
  // Live chat messages, typing and reactions, over LiveKit.
  useChatRealtime();

  return (
    <div className="with-sidebar" style={{ minHeight: '100%' }}>
      <Suspense fallback={<div className="v center" style={{ minHeight: '60vh' }}><Spinner /></div>}>
        <Outlet />
      </Suspense>
      <nav className={`tabbar${onTab ? '' : ' pushed'}`} aria-label="Main">
        <Link to="/" className="sidebar-brand">
          <span className="h center" style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.inverse }}>
            <Icon name="easel-outline" size={20} color="#fff" />
          </span>
          <Text variant="heading">Halaqa</Text>
        </Link>
        <div className="tabbar-inner">
          <span
            className="tabbar-indicator"
            style={{ width: `calc((100% - 12px) / ${tabs.length})`, transform: `translateX(${index * 100}%)` }}
          />
          {tabs.map((t, i) => {
            const on = i === section;
            return (
              <NavLink key={t.path} to={t.path} end={t.path === '/'} className={`tab press${on ? ' on' : ''}`} aria-label={t.label}
                style={{ ['--press-scale' as string]: 0.9 }}>
                <Icon name={on ? t.on : t.off} size={20} />
                <span className="tab-label">{t.label}</span>
              </NavLink>
            );
          })}
        </div>
        <div className="sidebar-foot"><SidebarInboxLink active={pathname === '/inbox'} /><Account /></div>
      </nav>
      <InboxToasts />
      <ChatWidget />
    </div>
  );
}
