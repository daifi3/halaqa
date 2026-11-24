import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { PAGE_SIZES, Pagination, useDebounced } from '@/components/admin/pagination';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { ChoiceRow } from '@/components/ui/choice';
import { Avatar, Chip, delay, EmptyState, IconButton, Skeleton } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { PageHeader } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { alert } from '@/lib/dialog';
import { formatDay } from '@/lib/format';
import { copyText } from '@/lib/links';
import { ROLE_ORDER, ROLES } from '@/lib/roles';
import type { AdminUser, Role, UserStatus } from '@/lib/types';
import { useQuery } from '@/lib/use-query';
import { useMe } from '@/store/session';
import { colors, radius } from '@/theme';
import { TabPage } from '../tabs/tab-page';

type Filter = 'all' | Role;
type View = 'grid' | 'list';

const VIEW_KEY = 'halaqa.adminUsersView';

function savedView(): View {
  try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'; } catch { return 'grid'; }
}

function StatTile({ label, value, tone, icon, onPress, index }: {
  label: string; value: number | undefined; tone: string; icon: IconName; onPress?: () => void; index: number;
}) {
  const body = (
    <>
      <span className="h center" style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: tone + '1F' }}>
        <Icon name={icon} size={18} color={tone} />
      </span>
      <Text variant="title">{value ?? '–'}</Text>
      <Text variant="small" color={colors.muted}>{label}</Text>
    </>
  );
  const style = {
    ...delay(40 + index * 50), display: 'flex', flexDirection: 'column' as const, gap: 6, padding: 14, borderRadius: radius.lg,
    backgroundColor: colors.surface, boxShadow: 'var(--shadow-card)', textAlign: 'left' as const, width: '100%',
  };
  return onPress
    ? <Pressable className="a-down" scaleTo={0.97} onClick={onPress} style={style}>{body}</Pressable>
    : <div className="a-down" style={style}>{body}</div>;
}

type RowProps = {
  user: AdminUser; me: boolean; index: number;
  onRole: () => void; onReset: () => void; onDelete: () => void; onRestore: () => void;
};

/** Role, reset password and delete; a deleted account only offers restore. */
function Actions({ user, me, onRole, onReset, onDelete, onRestore }: Omit<RowProps, 'index'>) {
  if (user.status === 'deleted') {
    return <Button title="Restore" icon="arrow-undo-outline" variant="secondary" size="md" onPress={onRestore} />;
  }
  return (
    <span className="h" style={{ gap: 6, flexShrink: 0 }}>
      <IconButton icon="swap-horizontal" label={`Assign a role to ${user.name}`} size={36} bg={colors.primarySoft}
        color={colors.primary} onPress={onRole} />
      <IconButton icon="key-outline" label={`Reset ${user.name}'s password`} size={36} bg={colors.surfaceAlt}
        color={colors.ink} onPress={onReset} />
      {!me && (
        <IconButton icon="trash-outline" label={`Delete ${user.name}`} size={36} bg={colors.dangerSoft}
          color={colors.danger} onPress={onDelete} />
      )}
    </span>
  );
}

function StatusLine({ user }: { user: AdminUser }) {
  return user.status === 'deleted' && user.deletedAt
    ? <Text variant="small" color={colors.danger}>Deleted {formatDay(user.deletedAt)}</Text>
    : <Text variant="small" color={colors.muted}>Joined {formatDay(user.createdAt)}</Text>;
}

function UserCard(props: RowProps) {
  const { user, me, index } = props;
  const r = ROLES[user.role];
  return (
    <div className="a-down v" style={{
      ...delay(40 + Math.min(index, 10) * 30), gap: 12, padding: 14, borderRadius: radius.lg,
      backgroundColor: colors.surface, boxShadow: 'var(--shadow-card)', opacity: user.status === 'deleted' ? 0.75 : 1,
    }}>
      <div className="h" style={{ gap: 12 }}>
        <Avatar name={user.name} size={44} uri={user.avatarUrl} ring={r.tone} />
        <div className="v flex1" style={{ gap: 2, minWidth: 0 }}>
          <span className="h" style={{ gap: 8, minWidth: 0 }}>
            <Text variant="bodyStrong" lines={1}>{user.name}</Text>
            {me && <Chip label="You" />}
          </span>
          <Text variant="small" color={colors.muted} lines={1}>{user.email}</Text>
        </div>
      </div>
      <div className="h" style={{ gap: 8, justifyContent: 'space-between' }}>
        <span className="v" style={{ gap: 4, minWidth: 0 }}>
          <Chip label={r.label} icon={r.icon} color={r.tone} bg={r.soft} />
          <StatusLine user={user} />
        </span>
        <Actions {...props} />
      </div>
    </div>
  );
}

function UserListRow(props: RowProps) {
  const { user, me, index } = props;
  const r = ROLES[user.role];
  return (
    <div className="admin-row a-down" style={{ ...delay(30 + Math.min(index, 12) * 20), opacity: user.status === 'deleted' ? 0.75 : 1 }}>
      <span className="h" style={{ gap: 12, minWidth: 0 }}>
        <Avatar name={user.name} size={36} uri={user.avatarUrl} ring={r.tone} />
        <span className="v" style={{ gap: 1, minWidth: 0 }}>
          <span className="h" style={{ gap: 8, minWidth: 0 }}>
            <Text variant="bodyStrong" lines={1}>{user.name}</Text>
            {me && <Chip label="You" />}
          </span>
          <Text variant="small" color={colors.muted} lines={1}>{user.email}</Text>
        </span>
      </span>
      <span className="admin-col-role"><Chip label={r.label} icon={r.icon} color={r.tone} bg={r.soft} /></span>
      <span className="admin-col-date"><StatusLine user={user} /></span>
      <span className="h" style={{ justifyContent: 'flex-end' }}><Actions {...props} /></span>
    </div>
  );
}

function ViewToggle({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  const item = (v: View, icon: IconName, label: string) => (
    <Pressable scaleTo={0.92} onClick={() => onChange(v)} aria-pressed={value === v} aria-label={label} title={label}
      style={{
        width: 40, height: 36, borderRadius: radius.md - 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: value === v ? colors.surface : 'transparent', boxShadow: value === v ? 'var(--shadow-card)' : 'none',
      }}>
      <Icon name={icon} size={18} color={value === v ? colors.ink : colors.muted} />
    </Pressable>
  );
  return (
    <span className="h" role="group" aria-label="Layout" style={{ gap: 2, padding: 3, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, flexShrink: 0 }}>
      {item('grid', 'grid-outline', 'Grid view')}
      {item('list', 'list-outline', 'List view')}
    </span>
  );
}

/** Admin: every account, with role assignment, password resets, delete/restore, grid or list, page by page. */
export default function AdminUsers() {
  const navigate = useNavigate();
  const me = useMe();
  const topRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<UserStatus>('active');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(PAGE_SIZES[0]!);
  const [view, setView] = useState<View>(savedView);

  // A new search, filter or page size starts again from page 1.
  useEffect(() => { setPage(0); }, [q, filter, status, size]);

  const list = useQuery(
    () => api.listUsers({ q, role: filter === 'all' ? undefined : filter, status, page, size }),
    [q, filter, status, page, size],
  );
  const statsQuery = useQuery(() => api.getAdminStats());
  const data = list.data;
  const stats = statsQuery.data;

  // After a delete empties the last page, step back to the new last page.
  useEffect(() => {
    if (data && data.totalPages > 0 && page >= data.totalPages) setPage(data.totalPages - 1);
  }, [data, page]);

  function changeView(v: View) {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* keeps working for this visit */ }
  }

  function goTo(p: number) {
    setPage(p);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function reloadAll() {
    void list.reload();
    void statsQuery.reload();
  }

  const replace = (u: AdminUser) => list.setData((d) => d && ({ ...d, items: d.items.map((x) => (x.id === u.id ? u : x)) }));

  function assignRole(user: AdminUser) {
    const choices = ROLE_ORDER.filter((r) => r !== user.role);
    alert(`Assign a role to ${user.name}`, `Currently ${ROLES[user.role].label.toLowerCase()}. The change applies the next time they open Halaqa.`, [
      ...choices.map((role) => ({
        text: `Make ${ROLES[role].label.toLowerCase()}`,
        style: role === 'admin' ? 'destructive' as const : 'default' as const,
        onPress: async () => {
          try {
            replace(await api.assignRole(user.id, role));
            reloadAll(); // role counts and the role filter change
          } catch (e) {
            alert('Couldn’t change the role', e instanceof Error ? e.message : 'Please try again.');
          }
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function resetPassword(user: AdminUser) {
    alert(`Reset ${user.name}'s password?`, 'They’ll be signed out on every device and need the new temporary password to sign in.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset password', style: 'destructive',
        onPress: async () => {
          try {
            const password = await api.resetUserPassword(user.id);
            await copyText(password);
            alert('New temporary password', `${user.email}\n${password}\n\nCopied to your clipboard. Share it with ${user.name.split(' ')[0]}; they can change it in Profile > Change password.`);
          } catch (e) {
            alert('Couldn’t reset the password', e instanceof Error ? e.message : 'Please try again.');
          }
        },
      },
    ]);
  }

  function deleteUser(user: AdminUser) {
    alert(`Delete ${user.name}?`, 'They’ll be signed out everywhere and can’t sign in any more. Their classes, messages and history are kept, and you can restore the account from the Deleted list.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete account', style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteUser(user.id);
            reloadAll();
          } catch (e) {
            alert('Couldn’t delete the account', e instanceof Error ? e.message : 'Please try again.');
          }
        },
      },
    ]);
  }

  async function restoreUser(user: AdminUser) {
    try {
      await api.restoreUser(user.id);
      reloadAll();
    } catch (e) {
      alert('Couldn’t restore the account', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  const counts = data?.counts;
  const items = data?.items ?? [];
  const rowProps = (u: AdminUser, i: number): RowProps => ({
    user: u, me: u.id === me.id, index: i,
    onRole: () => assignRole(u), onReset: () => resetPassword(u), onDelete: () => deleteUser(u), onRestore: () => void restoreUser(u),
  });

  return (
    <TabPage onRefresh={() => { void statsQuery.refresh(); return list.refresh(); }} refreshing={list.refreshing} gap={18}>
      <div className="h" style={{ gap: 12, alignItems: 'flex-start' }}>
        <div className="flex1">
          <PageHeader eyebrow={<Text variant="label" color={colors.success}>Admin</Text>} title="Users"
            subtitle="Create accounts and choose what each person can do."
            actions={<Button title="Create user" icon="person-add" size="md" onPress={() => navigate('/admin/users/new')} />} />
        </div>
        <span className="mobile-only">
          <IconButton icon="person-add" label="Create user" bg={colors.inverse} color="#fff" size={48}
            onPress={() => navigate('/admin/users/new')} style={{ marginTop: 14, marginRight: 44 }} />
        </span>
      </div>

      <div className="admin-stats">
        <StatTile index={0} label="Teachers" value={stats?.teachers} tone={ROLES.teacher.tone} icon="school"
          onPress={() => { setStatus('active'); setFilter('teacher'); }} />
        <StatTile index={1} label="Students" value={stats?.students} tone={ROLES.student.tone} icon="book"
          onPress={() => { setStatus('active'); setFilter('student'); }} />
        <StatTile index={2} label="Admins" value={stats?.admins} tone={ROLES.admin.tone} icon="shield-checkmark"
          onPress={() => { setStatus('active'); setFilter('admin'); }} />
        <StatTile index={3} label="New demo requests" value={stats?.newDemoRequests} tone={colors.danger} icon="mail-unread"
          onPress={() => navigate('/admin/requests')} />
      </div>

      <div ref={topRef} className="v" style={{ gap: 12, scrollMarginTop: 16 }}>
        <div className="h" style={{ gap: 10 }}>
          <div className="flex1" style={{ minWidth: 0 }}>
            <Input icon="search-outline" value={search} onChangeText={setSearch} placeholder="Search by name or email"
              autoCapitalize="none" autoCorrect="off" type="search" aria-label="Search users" />
          </div>
          <ViewToggle value={view} onChange={changeView} />
        </div>
        <div className="admin-filters">
          <ChoiceRow<UserStatus> value={status} onChange={setStatus} accent={status === 'deleted' ? colors.danger : colors.inverse} options={[
            { value: 'active', label: 'Active' },
            { value: 'deleted', label: 'Deleted' },
          ]} />
          <ChoiceRow<Filter> value={filter} onChange={setFilter} options={[
            { value: 'all', label: `All · ${counts?.all ?? '–'}` },
            ...ROLE_ORDER.map((r) => ({ value: r, label: `${ROLES[r].label}s · ${counts?.[r] ?? '–'}` })),
          ]} />
        </div>
      </div>

      {!data && list.loading ? (
        <div className={view === 'grid' ? 'cards-grid dense' : 'v'} style={{ gap: 12 }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={view === 'grid' ? 120 : 60} />)}
        </div>
      ) : list.error && !data ? (
        <EmptyState icon="cloud-offline-outline" title="Can't load users" body={list.error} />
      ) : items.length === 0 ? (
        <EmptyState icon={status === 'deleted' ? 'trash-outline' : 'people-outline'}
          title={q ? 'No match' : status === 'deleted' ? 'No deleted accounts' : 'No users here yet'}
          body={q ? `Nobody matches “${q}”.` : status === 'deleted' ? 'Accounts you delete show up here, ready to restore.' : 'Create the first account with the button above.'} />
      ) : (
        <div style={{ opacity: list.loading ? 0.55 : 1, transition: 'opacity 160ms ease' }} aria-busy={list.loading}>
          {view === 'grid' ? (
            <div key={`g${page}`} className="cards-grid dense" style={{ gap: 12 }}>
              {items.map((u, i) => <UserCard key={u.id} {...rowProps(u, i)} />)}
            </div>
          ) : (
            <div key={`l${page}`} className="admin-table">
              <div className="admin-row admin-head" aria-hidden>
                <Text variant="label" color={colors.muted}>Name</Text>
                <span className="admin-col-role"><Text variant="label" color={colors.muted}>Role</Text></span>
                <span className="admin-col-date"><Text variant="label" color={colors.muted}>{status === 'deleted' ? 'Deleted' : 'Joined'}</Text></span>
                <span />
              </div>
              {items.map((u, i) => <UserListRow key={u.id} {...rowProps(u, i)} />)}
            </div>
          )}
        </div>
      )}

      {data && data.total > 0 && (
        <Pagination page={data.page} totalPages={data.totalPages} total={data.total} size={size} onPage={goTo} onSize={setSize} noun="users" />
      )}
    </TabPage>
  );
}
