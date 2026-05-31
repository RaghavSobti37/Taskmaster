const fs = require('fs');

let code = fs.readFileSync('client/src/pages/settings/NavbarCustomizationPage.jsx', 'utf8');

// 1. Add dashboard imports
const importTarget = `import { useTheme } from '../../contexts/ThemeContext';`;
const importReplacement = `import { useTheme } from '../../contexts/ThemeContext';
import { useDashboardPreset } from '../../hooks/useTaskmasterQueries';`;
code = code.replace(importTarget, importReplacement);

// 2. Add dashboard state
const stateTarget = `  // Local UI settings State (Mock text size for now as requested)
  const [textSize, setTextSize] = useState('medium');`;

const stateReplacement = `  // Local UI settings State (Mock text size for now as requested)
  const [textSize, setTextSize] = useState('medium');
  
  // Dashboard State
  const { data: dashboardPreset, refetch: refetchDashboard } = useDashboardPreset();
  const [dashboardElements, setDashboardElements] = useState([]);
  
  useEffect(() => {
    if (dashboardPreset?.elements) {
      setDashboardElements([...dashboardPreset.elements].sort((a,b) => a.order - b.order));
    } else {
      setDashboardElements([
        { componentId: 'leaderboard', size: '1', order: 1, visible: true },
        { componentId: 'announcements', size: '1', order: 2, visible: true },
        { componentId: 'pinboard', size: '1', order: 3, visible: true },
        { componentId: 'schedule', size: '1', order: 4, visible: true },
        { componentId: 'review-queue', size: '3', order: 5, visible: true },
        { componentId: 'todos-overdue', size: '2', order: 6, visible: true },
        { componentId: 'todos-today', size: '2', order: 7, visible: true },
        { componentId: 'projects-today', size: '3', order: 8, visible: true },
        { componentId: 'notes', size: '1', order: 9, visible: true },
        { componentId: 'composer', size: '1', order: 10, visible: true }
      ]);
    }
  }, [dashboardPreset]);
  
  const handleReorderDashboard = (newOrder) => setDashboardElements(newOrder);
  
  const toggleDashboardElement = (componentId) => {
    setDashboardElements(prev => prev.map(el => el.componentId === componentId ? {...el, visible: !el.visible} : el));
  };
  
  const setDashboardElementSize = (componentId, size) => {
    setDashboardElements(prev => prev.map(el => el.componentId === componentId ? {...el, size} : el));
  };
  `;
code = code.replace(stateTarget, stateReplacement);

// 3. Update save logic
const saveTarget = `    try {
      await axios.post('/api/customization/navbar', {
        groups
      });

      setOriginalGroups(JSON.parse(JSON.stringify(groups)));`;

const saveReplacement = `    try {
      await axios.post('/api/customization/navbar', {
        groups
      });
      
      const elementsToSave = dashboardElements.map((el, idx) => ({ ...el, order: idx + 1 }));
      await axios.post('/api/customization/dashboard/preset', { 
        name: 'Custom', 
        elements: elementsToSave 
      });

      setOriginalGroups(JSON.parse(JSON.stringify(groups)));`;
code = code.replace(saveTarget, saveReplacement);

// 4. Update UI to add Dashboard section
const uiTarget = `      </div>
    </div>
  );`;

const uiReplacement = `        <hr className="border-[var(--color-bg-border)]" />

        {/* Dashboard Editor */}
        <section>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <LayoutTemplate size={18} className="text-blue-500" /> Dashboard Layout
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1"></p>
          </div>

          <Reorder.Group axis="y" values={dashboardElements} onReorder={handleReorderDashboard} className="space-y-3">
            <AnimatePresence>
              {dashboardElements.map((el) => (
                <Reorder.Item key={el.componentId} value={el} className="bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-xl shadow-sm flex flex-col md:flex-row items-center justify-between p-4 gap-4">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="cursor-grab active:cursor-grabbing p-1.5 text-[var(--color-text-muted)] hover:text-blue-500 hover:bg-blue-500/10 rounded transition-colors">
                      <GripVertical size={18} />
                    </div>
                    
                    <div className="font-bold text-[15px] text-[var(--color-text-primary)] tracking-wide capitalize">
                      {el.componentId.replace('-', ' ')}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                    <div className="flex items-center bg-[var(--color-bg-secondary)] rounded-lg p-1 border border-[var(--color-bg-border)]">
                      {['1', '2', '3'].map(s => (
                        <button
                          key={s}
                          onClick={() => setDashboardElementSize(el.componentId, s)}
                          className={\`px-3 py-1 text-xs font-bold rounded-md transition-colors \${el.size === s ? 'bg-blue-500 text-white shadow-sm' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-border)]'}\`}
                        >
                          Size {s}
                        </button>
                      ))}
                    </div>

                    <button onClick={() => toggleDashboardElement(el.componentId)} className="p-2 rounded-lg hover:bg-[var(--color-bg-workspace)] transition-colors border border-transparent hover:border-[var(--color-bg-border)]">
                      {el.visible ? <Eye size={18} className="text-blue-500" /> : <EyeOff size={18} className="text-[var(--color-text-muted)]" />}
                    </button>
                  </div>
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>
        </section>

      </div>
    </div>
  );`;
code = code.replace(uiTarget, uiReplacement);

fs.writeFileSync('client/src/pages/settings/NavbarCustomizationPage.jsx', code);
console.log('Updated CustomizationPage with Dashboard support.');
