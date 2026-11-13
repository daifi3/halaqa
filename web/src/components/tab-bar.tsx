import { Suspense } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useMe } from '@/store/session';
import { InboxToasts, SidebarInboxLink, useInboxPolling } from './inbox';
import { colors } from '@/theme';
import { Icon, type IconName } from './ui/icon';
import { Avatar, Spinner } from './ui/misc';
import { Text } from './ui/text';

export const TABS: { path: string; label: string; on: IconName; off: IconName }[] = [
  { path: '/', label: 'Classes', on: 'grid', off: 'grid-outline' },
  { path: '/courses', label: 'Courses', on: 'library', off: 'library-outline' },
  { path: '/exams', label: 'Exams', on: 'ribbon', off: 'ribbon-outline' },
  { path: '/recordings', label: 'Recordings', on: 'play-circle', off: 'play-circle-outline' },
  { path: '/profile', label: 'Profile', on: 'person-circle', off: 'person-circle-outline' },
];

/** Which tab a page belongs to, so the sidebar keeps its place on pages opened from a tab. */
function sectionOf(pathname: string) {
  if (pathname === '/' || /^\/(room|join)\b/.test(pathname)) return 0;
  if (/^\/(courses|course|homework)\b/.test(pathname)) return 1;
  if (/^\/(exams|exam)\b/.test(pathname)) return 2;
  if (/^\/recordings\b/.test(pathname)) return 3;
  if (/^\/(profile|vault|notifications|change-password)\b/.test(pathname)) return 4;
  return -1;
}

function Account() {
  const me = useMe();
  const tone = me.role === 'teacher' ? colors.teacher : colors.student;
  return (
    <Link to="/profile" className="sidebar-account press">
      <Avatar name={me.name} size={38} ring={tone} uri={me.avatarUrl} />
      <span className="v flex1" style={{ minWidth: 0 }}>
        <Text variant="bodyStrong" lines={1}>{me.name}</Text>
        <Text variant="small" color={colors.muted}>{me.role === 'teacher' ? 'Teacher' : 'Student'}</Text>
      </span>
    </Link>
  );
}

/**
 * The signed-in app around every page. Phones: the floating pill tab bar, on the five tabs only,
 * with an indicator that springs between tabs. Desktop: a sidebar on every page.
 */
export function TabsLayout() {
  const { pathname } = useLocation();
  const section = sectionOf(pathname);
  const onTab = TABS.some((t) => t.path === pathname);
  const index = Math.max(0, section);
  useInboxPolling();

  return (
    <div className="with-sidebar" style={{ minHeight: '100%' }}>
      <Suspense fallback={<div className="v center" style={{ minHeight: '60vh' }}><Spinner /></div>}>
        <Outlet />
      </Suspense>
      <nav className={`tabbar${onTab ? '' : ' pushed'}`} aria-label="Main">
        <Link to="/" className="sidebar-brand">
          <span className="h center" style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.ink }}>
            <Icon name="easel-outline" size={20} color="#fff" />
          </span>
          <Text variant="heading">Halaqa</Text>
        </Link>
        <div className="tabbar-inner">
          <span
            className="tabbar-indicator"
            style={{ width: `calc((100% - 12px) / ${TABS.length})`, transform: `translateX(${index * 100}%)` }}
          />
          {TABS.map((t, i) => {
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
    </div>
  );
}
