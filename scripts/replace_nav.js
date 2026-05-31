const fs = require('fs');
let code = fs.readFileSync('client/src/components/OutletSidebar.jsx', 'utf8');

const replacement = `        <nav className="flex-1 px-2 mt-2 space-y-1 overflow-y-auto custom-scrollbar pb-4">
          {navbarPreferences?.pageOrder && navbarPreferences.pageOrder.length > 0 ? (
            navbarPreferences.pageOrder
              .filter(page => page.visible && PAGE_CONFIG[page.path] && hasPageAccess(user, PAGE_CONFIG[page.path].accessKey))
              .sort((a, b) => a.order - b.order)
              .map((page) => {
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
              })
          ) : (
            <div className="text-xs text-gray-400 p-4 text-center">No navigation preferences found. Please configure your navigation.</div>
          )}
        </nav>`;

const startIndex = code.indexOf('<nav className="flex-1');
const endIndex = code.indexOf('</nav>', startIndex) + 6;
const newCode = code.substring(0, startIndex) + replacement + code.substring(endIndex);
fs.writeFileSync('client/src/components/OutletSidebar.jsx', newCode);
console.log('Replaced successfully!');
