const fs = require('fs');

let code = fs.readFileSync('client/src/components/OutletSidebar.jsx', 'utf8');

// 1. Imports
const importsTarget = `import { Menu } from 'lucide-react';`;
const importsReplacement = `import { Menu, Settings } from 'lucide-react';\nimport { useNavbarPreferences } from '../hooks/useTaskmasterQueries';`;
code = code.replace(importsTarget, importsReplacement);

// 2. PAGE_CONFIG
const pageConfigTarget = `const NavItem = ({ to, icon: Icon, label, count, todayCount, collapsed, isMobile, onClick, end }) => {`;
const pageConfigReplacement = `const PAGE_CONFIG = {
  '/dashboard': { icon: LayoutDashboard, label: 'Dashboard', accessKey: 'dashboard' },
  '/calendar': { icon: CalendarDays, label: 'Calendar', accessKey: 'calendar' },
  '/todo': { icon: ListTodo, label: 'Todo', accessKey: 'todo' },
  '/inbox': { icon: Inbox, label: 'Inbox', accessKey: 'inbox' },
  '/projects': { icon: Briefcase, label: 'Projects', accessKey: 'projects' },
  '/assets': { icon: FolderArchive, label: 'Assets', accessKey: 'assets', end: true },
  '/schedule': { icon: CalendarClock, label: 'Schedule', accessKey: 'schedule' },
  '/logs': { icon: NotebookPen, label: 'Daily Logs', accessKey: 'logs' },
  '/emails': { icon: Mail, label: 'Emails', accessKey: 'emails' },
  '/equipment': { icon: Wrench, label: 'Equipment', accessKey: 'equipment' },
  '/contacts': { icon: Contact, label: 'Contacts', accessKey: 'contacts' },
  '/attendance': { icon: ClipboardCheck, label: 'Attendance', accessKey: 'attendance' },
  '/leads': { icon: UserPlus, label: 'Leads', accessKey: 'leads' },
  '/followups': { icon: PhoneCall, label: 'Followups', accessKey: 'followups' },
  '/bookings': { icon: CalendarCheck, label: 'Bookings', accessKey: 'bookings' },
  '/finance': { icon: CircleDollarSign, label: 'Finance', accessKey: 'finance' },
  '/announcements': { icon: Megaphone, label: 'Announcements', accessKey: 'announcements' },
  '/ops-logs': { icon: Activity, label: 'Ops Logs', accessKey: 'ops_logs' },
  '/artists': { icon: Mic2, label: 'Artists', accessKey: 'artists' },
  '/admin/users': { icon: Users, label: 'Users & Teams', accessKey: 'admin_users' },
  '/admin': { icon: Database, label: 'All Data', accessKey: 'admin_data', end: true },
  '/admin/exly-campaigns': { icon: BarChart2, label: 'Exly Data', accessKey: 'admin_exly' },
  '/admin/scripts': { icon: Brackets, label: 'Script Runner', accessKey: 'admin_scripts' },
  '/admin/gamification': { icon: Trophy, label: 'Gamification', accessKey: 'admin_gamification' },
};

const NavItem = ({ to, icon: Icon, label, count, todayCount, collapsed, isMobile, onClick, end }) => {`;
code = code.replace(pageConfigTarget, pageConfigReplacement);

// 3. State
const stateTarget = `  const { width } = useWindowSize();`;
const stateReplacement = `  const { width } = useWindowSize();
  const { data: navbarPreferences } = useNavbarPreferences();`;
code = code.replace(stateTarget, stateReplacement);

// 4. Nav Block
const navBlockTargetStart = `<nav className="flex-1 px-2 mt-2 space-y-1 overflow-y-auto custom-scrollbar pb-4">`;
const navBlockTargetEnd = `</nav>`;

const navBlockReplacement = `<nav className="flex-1 px-2 mt-2 space-y-1 overflow-y-auto custom-scrollbar pb-4">
          {(navbarPreferences?.groups && navbarPreferences.groups.length > 0 ? navbarPreferences.groups : [
            { id: 'platform', title: 'Platform', visible: true, pages: [{path: '/dashboard'}, {path: '/calendar'}, {path: '/todo'}, {path: '/inbox'}] },
            { id: 'workspace', title: 'Workspace', visible: true, pages: [{path: '/projects'}, {path: '/assets'}, {path: '/schedule'}, {path: '/logs'}, {path: '/emails'}] },
            { id: 'office', title: 'Office', visible: true, pages: [{path: '/equipment'}, {path: '/contacts'}, {path: '/attendance'}] },
            { id: 'crm', title: 'CRM', visible: true, pages: [{path: '/leads'}, {path: '/followups'}, {path: '/bookings'}] },
            { id: 'management', title: 'Management', visible: true, pages: [{path: '/finance'}, {path: '/announcements'}, {path: '/ops-logs'}, {path: '/artists'}] },
            { id: 'admin', title: 'Admin', visible: true, pages: [{path: '/admin/users'}, {path: '/admin'}, {path: '/admin/exly-campaigns'}, {path: '/admin/scripts'}, {path: '/admin/gamification'}] }
          ])
            .filter(group => group.visible)
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map(group => {
              const visiblePages = (group.pages || [])
                .filter(page => (page.visible !== false) && PAGE_CONFIG[page.path] && hasPageAccess(user, PAGE_CONFIG[page.path].accessKey))
                .sort((a, b) => (a.order || 0) - (b.order || 0));
                
              if (visiblePages.length === 0) return null;

              return (
                <NavGroup key={group.id} title={group.title} collapsed={!showLabels} isMobile={isMobile}>
                  {visiblePages.map(page => {
                    const config = PAGE_CONFIG[page.path];
                    return (
                      <NavItem
                        key={page.path}
                        to={page.path}
                        icon={config.icon}
                        label={page.label || config.label}
                        collapsed={!showLabels}
                        isMobile={isMobile}
                        end={config.end}
                        count={
                          page.path === '/inbox' ? statusCounts.notifications?.unread :
                          page.path === '/followups' ? statusCounts.followups?.overdue : 0
                        }
                        todayCount={
                          page.path === '/calendar' ? statusCounts.calendar?.today : 0
                        }
                        onMouseEnter={() => {
                          if (page.path === '/dashboard') {
                            queryClient.prefetchQuery({ queryKey: ['logs', user?._id], queryFn: async () => (await axios.get(\`/api/logs?userId=\${user?._id}\`)).data });
                          } else if (page.path === '/calendar') {
                            queryClient.prefetchQuery({ queryKey: ['calendar'], queryFn: async () => (await axios.get('/api/calendar')).data });
                          } else if (page.path === '/projects') {
                            queryClient.prefetchQuery({ queryKey: ['projects'], queryFn: async () => (await axios.get('/api/projects')).data });
                          } else if (page.path === '/assets') {
                            queryClient.prefetchQuery({ queryKey: ['assets'], queryFn: async () => (await axios.get('/api/assets')).data });
                          } else if (page.path === '/leads') {
                            queryClient.prefetchQuery({ queryKey: ['leads'], queryFn: async () => (await axios.get('/api/crm/leads')).data });
                          } else if (page.path === '/artists') {
                            queryClient.prefetchQuery({ queryKey: ['artists'], queryFn: async () => (await axios.get('/api/artists')).data });
                          } else if (page.path === '/admin/users') {
                            queryClient.prefetchQuery({ queryKey: ['userDirectory'], queryFn: async () => (await axios.get('/api/users/directory')).data.users });
                            queryClient.prefetchQuery({ queryKey: ['teams'], queryFn: async () => (await axios.get('/api/teams')).data });
                          }
                        }}
                      />
                    );
                  })}
                </NavGroup>
              );
            })}
        </nav>`;

const startIndex = code.indexOf(navBlockTargetStart);
const endIndex = code.indexOf(navBlockTargetEnd, startIndex) + 6;
code = code.substring(0, startIndex) + navBlockReplacement + code.substring(endIndex);

// 5. Customize Button
const btnTarget1 = `        <div className="p-2 border-t border-[var(--color-bg-border)] space-y-1.5">\r
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} collapsed={!showLabels} isMobile={isMobile} />\r
\r
          <div\r
            onClick={() => navigate('/settings')}`;
const btnTarget2 = `        <div className="p-2 border-t border-[var(--color-bg-border)] space-y-1.5">\n          <ThemeToggle theme={theme} toggleTheme={toggleTheme} collapsed={!showLabels} isMobile={isMobile} />\n\n          <div\n            onClick={() => navigate('/settings')}`;

const btnReplacement = `        <div className="p-2 border-t border-[var(--color-bg-border)] space-y-1.5">
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} collapsed={!showLabels} isMobile={isMobile} />

          {!(!showLabels && !isMobile) && (
            <button
              onClick={() => navigate('/settings/navigation')}
              className="w-full flex items-center justify-between px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg hover:border-blue-500/50 transition-all group overflow-hidden"
            >
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-[var(--color-text-secondary)] group-hover:text-blue-500 transition-colors" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">
                  Navigation
                </span>
              </div>
            </button>
          )}

          {(!showLabels && !isMobile) && (
             <button
              onClick={() => navigate('/settings/navigation')}
              title="Customize Navigation"
              className="w-full flex items-center justify-center p-2 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] hover:border-blue-500/50 transition-colors"
            >
              <Settings size={16} className="text-[var(--color-text-secondary)] hover:text-blue-500 transition-colors" />
            </button>
          )}

          <div
            onClick={() => navigate('/settings')}`;

if (code.includes(btnTarget1)) {
  code = code.replace(btnTarget1, btnReplacement);
} else if (code.includes(btnTarget2)) {
  code = code.replace(btnTarget2, btnReplacement);
}

fs.writeFileSync('client/src/components/OutletSidebar.jsx', code);
console.log('Restored and updated OutletSidebar successfully!');
