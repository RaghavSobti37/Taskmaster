import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { LayoutDashboard, GripVertical, Plus, EyeOff, Scaling, PanelRight, X } from 'lucide-react';
import UnsavedChangesBar from '../components/UnsavedChangesBar';
import { useDashboardPreset } from '../../../hooks/useTaskmasterQueries';
import { useAuth } from '../../../contexts/AuthContext';
import { COMPONENT_REGISTRY, LAYOUT_TEMPLATES, getAccessibleComponents, getAccessibleTemplates } from '../../../lib/componentRegistry';

const GRID_COLS = 4;
const GAP = 16;
const CELL_HEIGHT = 160;

const clampCol = (col, size) => Math.max(1, Math.min(col, GRID_COLS - (parseInt(size) || 1) + 1));
const clampRow = (row) => Math.max(1, row);

const resolveCollisions = (elements, ghostId = null, ghostTarget = null) => {
  const visibleEls = elements.filter(e => e.visible);
  const hiddenEls = elements.filter(e => !e.visible);
  
  const reqPos = visibleEls.map(el => {
    if (ghostId === el.componentId && ghostTarget) {
      return { ...el, row: ghostTarget.row, col: clampCol(ghostTarget.col, el.size), isGhost: true };
    }
    return el;
  });

  reqPos.sort((a, b) => {
    if (a.isGhost) return -1;
    if (b.isGhost) return 1;
    return (a.row - b.row) || (a.col - b.col);
  });

  const grid = [];
  const isOccupied = (r, c, size) => {
    for (let i = 0; i < size; i++) {
      if (grid[r] && grid[r][c + i]) return true;
    }
    return false;
  };
  const markOccupied = (r, c, size) => {
    if (!grid[r]) grid[r] = [];
    for (let i = 0; i < size; i++) grid[r][c + i] = true;
  };

  const placed = [];
  for (const el of reqPos) {
    const sizeNum = parseInt(el.size) || 1;
    let placedRow = 1;
    let placedCol = 1;
    let found = false;

    if (el.isGhost) {
      placedRow = el.row;
      placedCol = el.col;
      markOccupied(placedRow, placedCol, sizeNum);
      placed.push({ ...el, row: placedRow, col: placedCol });
      continue;
    }

    for (let r = 1; r < 100; r++) {
      for (let c = 1; c <= GRID_COLS - sizeNum + 1; c++) {
        if (!isOccupied(r, c, sizeNum)) {
          placedRow = r;
          placedCol = c;
          found = true;
          break;
        }
      }
      if (found) break;
    }
    
    markOccupied(placedRow, placedCol, sizeNum);
    placed.push({ ...el, row: placedRow, col: placedCol });
  }

  return [...placed.map(p => {
    const copy = { ...p };
    delete copy.isGhost;
    return copy;
  }), ...hiddenEls];
};

const findFirstAvailableVacancy = (elements, sizeNum) => {
  const visibleEls = elements.filter(e => e.visible);
  const grid = [];
  const markOccupied = (r, c, size) => {
    if (!grid[r]) grid[r] = [];
    for (let i = 0; i < size; i++) grid[r][c + i] = true;
  };
  
  visibleEls.forEach(el => markOccupied(el.row, el.col, parseInt(el.size) || 1));

  const isOccupied = (r, c, size) => {
    for (let i = 0; i < size; i++) {
      if (grid[r] && grid[r][c + i]) return true;
    }
    return false;
  };

  for (let r = 1; r < 100; r++) {
    for (let c = 1; c <= GRID_COLS - sizeNum + 1; c++) {
      if (!isOccupied(r, c, sizeNum)) {
        return { row: r, col: c };
      }
    }
  }
  return { row: 99, col: 1 };
};

export default function DashboardCustomizationTab() {
  const { user } = useAuth();
  const permissionPreset = user?.departmentId?.permissionPreset || 'standard';
  
  const [saving, setSaving] = useState(false);
  const [originalElements, setOriginalElements] = useState([]);
  const { data: dashboardPreset } = useDashboardPreset();
  const [dashboardElements, setDashboardElements] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('custom');
  
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [dragId, setDragId] = useState(null);
  const [dragDelta, setDragDelta] = useState({ dx: 0, dy: 0 });
  const [dropTarget, setDropTarget] = useState(null); 
  const dragRef = useRef(null); 
  const gridRef = useRef(null);
  const dropTargetRef = useRef(null);

  useEffect(() => {
    let init;
    if (dashboardPreset?.elements?.length) {
      init = dashboardPreset.elements.map((el, i) => ({
        ...el, col: el.col ?? 1, row: el.row ?? (i + 1),
      }));
    } else {
      init = JSON.parse(JSON.stringify(LAYOUT_TEMPLATES.find(t => t.id === 'coreknot').elements.map(e => ({...e, visible: true}))));
    }
    
    const accessibleCompIds = getAccessibleComponents(permissionPreset);
    init = init.filter(el => accessibleCompIds.includes(el.componentId));
    
    // Auto-pack once on load just to be safe
    init = resolveCollisions(init);
    
    setDashboardElements(init);
    setOriginalElements(JSON.parse(JSON.stringify(init)));
  }, [dashboardPreset, permissionPreset]);

  const applyTemplate = (templateId) => {
    if (templateId === 'custom') return;
    const template = LAYOUT_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    
    const accessibleCompIds = getAccessibleComponents(permissionPreset);
    let elements = template.elements
      .filter(el => accessibleCompIds.includes(el.componentId))
      .map(el => ({ ...el, visible: true }));
      
    const templateCompIds = elements.map(e => e.componentId);
    dashboardElements.forEach(existing => {
      if (!templateCompIds.includes(existing.componentId)) {
        elements.push({ ...existing, visible: false, col: 1, row: 99 });
      }
    });

    setDashboardElements(resolveCollisions(elements));
    setSelectedTemplate(templateId);
  };

  const getGridMetrics = useCallback(() => {
    if (!gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    const colWidth = (rect.width - (GRID_COLS - 1) * GAP) / GRID_COLS;
    return { rect, colWidth };
  }, []);

  const cellFromPoint = useCallback((clientX, clientY, elSize) => {
    const m = getGridMetrics();
    if (!m) return null;
    const relX = clientX - m.rect.left;
    const relY = clientY - m.rect.top;
    const col = Math.floor(relX / (m.colWidth + GAP)) + 1;
    const row = Math.floor(relY / (CELL_HEIGHT + GAP)) + 1;
    return { col: clampCol(col, elSize), row: clampRow(row) };
  }, [getGridMetrics]);

  const placeElement = useCallback((componentId, updates) => {
    setDashboardElements(prev => {
      const next = prev.map(el => {
        if (el.componentId !== componentId) return el;
        const n = { ...el, ...updates };
        n.col = clampCol(n.col, n.size);
        n.row = clampRow(n.row);
        return n;
      });
      return resolveCollisions(next);
    });
    setSelectedTemplate('custom');
  }, []);

  const toggleVisibility = (componentId, e) => {
    if (e) e.stopPropagation();
    setDashboardElements(prev => {
      const next = prev.map(el =>
        el.componentId === componentId ? { ...el, visible: !el.visible } : el
      );
      return resolveCollisions(next);
    });
    setSelectedTemplate('custom');
  };

  const addComponent = (componentId) => {
    const meta = COMPONENT_REGISTRY[componentId];
    if (!meta) return;
    setDashboardElements(prev => {
      const exists = prev.find(p => p.componentId === componentId);
      const sizeStr = exists ? exists.size : '1';
      const vacancy = findFirstAvailableVacancy(prev, parseInt(sizeStr));
      
      let nextState;
      if (exists) {
        nextState = prev.map(p => p.componentId === componentId ? { ...p, visible: true, col: vacancy.col, row: vacancy.row } : p);
      } else {
        const newEl = { componentId, size: sizeStr, col: vacancy.col, row: vacancy.row, visible: true };
        nextState = [...prev, newEl];
      }
      return resolveCollisions(nextState);
    });
    setSelectedTemplate('custom');
    
    setTimeout(() => {
      if (gridRef.current) {
        const els = gridRef.current.querySelectorAll(`[data-comp="${componentId}"]`);
        if (els.length > 0) {
          els[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }, 100);
  };

  const handlePointerDown = useCallback((e, el) => {
    if (e.button !== 0) return;
    if (e.target.closest('.no-drag')) return; 
    e.preventDefault();
    const dr = { id: el.componentId, startX: e.clientX, startY: e.clientY, size: el.size, origCol: el.col, origRow: el.row };
    dragRef.current = dr;
    dropTargetRef.current = { col: el.col, row: el.row };
    setDragId(el.componentId);
    setDragDelta({ dx: 0, dy: 0 });
    setDropTarget({ col: el.col, row: el.row });

    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      setDragDelta({ dx, dy });
      const target = cellFromPoint(ev.clientX, ev.clientY, d.size);
      if (target && (target.col !== dropTargetRef.current.col || target.row !== dropTargetRef.current.row)) {
        dropTargetRef.current = target;
        setDropTarget({ ...target });
      }
    };

    const onUp = () => {
      const d = dragRef.current;
      const t = dropTargetRef.current;
      if (d && t) {
        setDashboardElements(prev => resolveCollisions(prev, d.id, t));
        setSelectedTemplate('custom');
      }
      dragRef.current = null;
      dropTargetRef.current = null;
      setDragId(null);
      setDragDelta({ dx: 0, dy: 0 });
      setDropTarget(null);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [cellFromPoint]);

  const handleResizeDown = (e, el) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startSize = parseInt(el.size) || 1;
    const m = getGridMetrics();
    if (!m) return;
    const cellW = m.colWidth + GAP;
    let newSize = startSize;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const sizeDelta = Math.round(dx / cellW);
      newSize = startSize + sizeDelta;
      newSize = Math.max(1, Math.min(newSize, GRID_COLS - el.col + 1));
      if (newSize !== parseInt(el.size)) {
         placeElement(el.componentId, { size: String(newSize) });
      }
    };
    
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const elementsToSave = dashboardElements.map((el, idx) => ({
        componentId: el.componentId, size: el.size, col: el.col, row: el.row, order: idx + 1, visible: el.visible,
      }));
      await axios.post('/api/customization/dashboard/preset', { name: 'Custom', elements: elementsToSave });
      setOriginalElements(JSON.parse(JSON.stringify(dashboardElements)));
      window.location.reload();
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = () => {
    setDashboardElements(JSON.parse(JSON.stringify(originalElements)));
    setSelectedTemplate('custom');
  };

  const hasChanges = JSON.stringify(dashboardElements) !== JSON.stringify(originalElements);
  const colSpanClass = (size) => ({ '4': 'col-span-4', '3': 'col-span-3', '2': 'col-span-2' }[String(size)] || 'col-span-1');

  const renderDummyContent = (id) => {
    switch (id) {
      case 'leaderboard': return (
        <div className="space-y-2 w-full">
          <div className="flex items-center gap-2"><span className="text-yellow-500 text-sm">🥇</span><div className="h-3.5 bg-yellow-400/80 rounded-full flex-1"></div><span className="text-xs font-bold text-[var(--color-text-muted)]">142</span></div>
          <div className="flex items-center gap-2"><span className="text-gray-400 text-sm">🥈</span><div className="h-3.5 bg-gray-300/80 rounded-full w-3/4"></div><span className="text-xs font-bold text-[var(--color-text-muted)]">98</span></div>
          <div className="flex items-center gap-2"><span className="text-orange-500 text-sm">🥉</span><div className="h-3.5 bg-orange-400/80 rounded-full w-1/2"></div><span className="text-xs font-bold text-[var(--color-text-muted)]">71</span></div>
        </div>
      );
      case 'todos-today': return (
        <div className="space-y-2 w-full">
          <div className="flex gap-2 items-center"><div className="w-3.5 h-3.5 rounded border-2 border-blue-400 shrink-0"></div><div className="h-3 bg-[var(--color-text-primary)] rounded w-full opacity-40"></div></div>
          <div className="flex gap-2 items-center"><div className="w-3.5 h-3.5 rounded border-2 border-blue-400 shrink-0"></div><div className="h-3 bg-[var(--color-text-primary)] rounded w-4/5 opacity-40"></div></div>
          <div className="flex gap-2 items-center"><div className="w-3.5 h-3.5 rounded bg-blue-500 shrink-0 flex items-center justify-center"><span className="text-white text-[8px]">✓</span></div><div className="h-3 bg-[var(--color-text-primary)] rounded w-3/5 opacity-20"></div></div>
        </div>
      );
      case 'todos-overdue': return (
        <div className="space-y-2 w-full">
          <div className="flex gap-2 items-center"><div className="w-3.5 h-3.5 rounded border-2 border-red-500 shrink-0"></div><div className="h-3 bg-red-500 rounded w-full opacity-50"></div><span className="text-[9px] text-red-500 font-bold shrink-0">-2d</span></div>
          <div className="flex gap-2 items-center"><div className="w-3.5 h-3.5 rounded border-2 border-red-500 shrink-0"></div><div className="h-3 bg-red-500 rounded w-3/4 opacity-50"></div><span className="text-[9px] text-red-500 font-bold shrink-0">-5d</span></div>
        </div>
      );
      case 'projects-today': return (
        <div className="flex gap-3 w-full items-end justify-center h-14">
          <div className="flex flex-col items-center gap-1"><div className="w-7 bg-blue-500 rounded-t h-14"></div><div className="text-[8px] text-[var(--color-text-muted)]">Web</div></div>
          <div className="flex flex-col items-center gap-1"><div className="w-7 bg-blue-400 rounded-t h-10"></div><div className="text-[8px] text-[var(--color-text-muted)]">API</div></div>
          <div className="flex flex-col items-center gap-1"><div className="w-7 bg-blue-300 rounded-t h-6"></div><div className="text-[8px] text-[var(--color-text-muted)]">App</div></div>
          <div className="flex flex-col items-center gap-1"><div className="w-7 bg-emerald-400 rounded-t h-8"></div><div className="text-[8px] text-[var(--color-text-muted)]">CRM</div></div>
        </div>
      );
      case 'schedule': return (
        <div className="space-y-1.5 w-full">
          <div className="flex gap-2 items-center"><div className="w-1 h-4 bg-blue-500 rounded-full shrink-0"></div><div className="text-[10px] text-[var(--color-text-muted)]">9:00</div><div className="h-3 flex-1 bg-blue-500/20 rounded"></div></div>
          <div className="flex gap-2 items-center"><div className="w-1 h-4 bg-purple-500 rounded-full shrink-0"></div><div className="text-[10px] text-[var(--color-text-muted)]">11:30</div><div className="h-3 flex-1 bg-purple-500/20 rounded"></div></div>
          <div className="flex gap-2 items-center"><div className="w-1 h-4 bg-emerald-500 rounded-full shrink-0"></div><div className="text-[10px] text-[var(--color-text-muted)]">2:00</div><div className="h-3 flex-1 bg-emerald-500/20 rounded"></div></div>
        </div>
      );
      case 'review-queue': return (
        <div className="space-y-2 w-full">
          <div className="h-7 bg-[var(--color-bg-secondary)] rounded flex items-center justify-between px-2"><div className="h-2.5 w-1/2 bg-[var(--color-text-muted)] rounded opacity-40"></div><div className="h-4 w-10 bg-green-500/80 rounded text-[8px] text-white flex items-center justify-center">Accept</div></div>
          <div className="h-7 bg-[var(--color-bg-secondary)] rounded flex items-center justify-between px-2"><div className="h-2.5 w-2/5 bg-[var(--color-text-muted)] rounded opacity-40"></div><div className="h-4 w-10 bg-green-500/80 rounded text-[8px] text-white flex items-center justify-center">Accept</div></div>
        </div>
      );
      case 'notes': return (
        <div className="w-full"><div className="bg-yellow-100/50 dark:bg-yellow-900/30 rounded p-2 space-y-1.5"><div className="h-2 w-1/3 bg-yellow-400/60 rounded"></div><div className="h-2 w-full bg-yellow-300/40 rounded"></div><div className="h-2 w-4/5 bg-yellow-300/40 rounded"></div></div></div>
      );
      case 'announcements': return (
        <div className="w-full space-y-2"><div className="flex gap-2 items-start"><div className="w-4 h-4 bg-blue-500 rounded-full shrink-0 mt-0.5"></div><div className="space-y-1 flex-1"><div className="h-2.5 w-full bg-blue-200/60 dark:bg-blue-800/60 rounded"></div><div className="h-2 w-3/4 bg-blue-100/60 dark:bg-blue-900/40 rounded"></div></div></div></div>
      );
      case 'pinboard': return (
        <div className="w-full space-y-2"><div className="h-5 w-3/5 bg-[var(--color-bg-secondary)] rounded-lg rounded-bl-none ml-auto px-2 flex items-center"><div className="h-1.5 w-full bg-[var(--color-text-muted)] rounded opacity-30"></div></div><div className="h-5 w-3/5 bg-blue-500/80 rounded-lg rounded-br-none px-2 flex items-center"><div className="h-1.5 w-full bg-white rounded opacity-40"></div></div></div>
      );
      case 'composer': return (
        <div className="w-full"><div className="h-9 w-full bg-[var(--color-bg-secondary)] rounded-full flex items-center px-3 gap-2"><div className="w-4 h-4 rounded-full bg-[var(--color-text-muted)] opacity-30 shrink-0"></div><div className="h-2 w-1/2 bg-[var(--color-text-muted)] rounded opacity-20"></div></div></div>
      );
      case 'mark-attendance': return (
        <div className="w-full flex items-center justify-center h-full"><div className="h-10 w-32 bg-emerald-500 rounded-full flex items-center justify-center"><span className="text-white text-xs font-bold">Clock In</span></div></div>
      );
      case 'leave-alerts': return (
        <div className="space-y-2 w-full"><div className="h-6 bg-amber-500/10 border border-amber-500/20 rounded flex items-center px-2"><div className="h-2 w-1/3 bg-amber-500/60 rounded"></div></div></div>
      );
      case 'invoice-alerts': return (
        <div className="space-y-2 w-full"><div className="h-6 bg-blue-500/10 border border-blue-500/20 rounded flex items-center px-2"><div className="h-2 w-1/3 bg-blue-500/60 rounded"></div></div></div>
      );
      case 'booked-calls': return (
        <div className="space-y-2 w-full"><div className="flex gap-2 items-center"><div className="w-6 h-6 rounded-full bg-emerald-500/20"></div><div className="h-2 w-1/2 bg-[var(--color-text-primary)] opacity-40 rounded"></div></div></div>
      );
      case 'followups-today': return (
        <div className="space-y-2 w-full"><div className="flex gap-2 items-center"><div className="w-6 h-6 rounded bg-rose-500/20"></div><div className="h-2 w-1/2 bg-[var(--color-text-primary)] opacity-40 rounded"></div></div></div>
      );
      case 'pipeline-summary': return (
        <div className="flex w-full h-8 rounded-lg overflow-hidden"><div className="w-1/3 bg-blue-400"></div><div className="w-1/3 bg-blue-500"></div><div className="w-1/3 bg-emerald-500"></div></div>
      );
      case 'team-activity': return (
        <div className="space-y-2 w-full"><div className="flex gap-2 items-center"><div className="w-4 h-4 rounded-full bg-blue-500 shrink-0"></div><div className="h-2 w-3/4 bg-[var(--color-text-muted)] opacity-40 rounded"></div></div><div className="flex gap-2 items-center"><div className="w-4 h-4 rounded-full bg-emerald-500 shrink-0"></div><div className="h-2 w-1/2 bg-[var(--color-text-muted)] opacity-40 rounded"></div></div></div>
      );
      case 'dept-stats': return (
        <div className="flex gap-2 w-full h-12"><div className="flex-1 bg-[var(--color-bg-secondary)] rounded flex items-center justify-center"><div className="h-3 w-1/2 bg-[var(--color-text-muted)] opacity-40 rounded"></div></div><div className="flex-1 bg-[var(--color-bg-secondary)] rounded flex items-center justify-center"><div className="h-3 w-1/2 bg-[var(--color-text-muted)] opacity-40 rounded"></div></div></div>
      );
      case 'attendance-overview': return (
        <div className="flex w-full h-12 gap-2"><div className="flex-1 border-2 border-emerald-500/30 rounded flex items-center justify-center"><div className="h-3 w-1/2 bg-emerald-500/40 rounded"></div></div><div className="flex-1 border-2 border-rose-500/30 rounded flex items-center justify-center"><div className="h-3 w-1/2 bg-rose-500/40 rounded"></div></div></div>
      );
      case 'campaign-metrics': return (
        <div className="w-full flex items-center justify-center gap-4"><div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-blue-200"></div></div>
      );
      case 'system-health': return (
        <div className="w-full flex flex-col items-center justify-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div><div className="h-2 w-16 bg-[var(--color-text-muted)] opacity-40 rounded"></div></div>
      );
      case 'artist-calendar': return (
        <div className="space-y-1.5 w-full"><div className="h-6 bg-purple-500/20 rounded flex items-center px-2"><div className="h-2 w-1/2 bg-purple-500/60 rounded"></div></div><div className="h-6 bg-pink-500/20 rounded flex items-center px-2"><div className="h-2 w-1/3 bg-pink-500/60 rounded"></div></div></div>
      );
      default: return <div className="w-full h-8 bg-[var(--color-bg-secondary)] rounded"></div>;
    }
  };

  const accessibleTemplates = getAccessibleTemplates(permissionPreset);
  const accessibleComponents = getAccessibleComponents(permissionPreset);
  
  const availableToAdd = accessibleComponents.filter(id => {
    const existing = dashboardElements.find(e => e.componentId === id);
    return !existing || !existing.visible;
  });

  const displayElements = useMemo(() => {
    if (dragId && dropTarget) {
      return resolveCollisions(dashboardElements, dragId, dropTarget);
    }
    return dashboardElements;
  }, [dashboardElements, dragId, dropTarget]);

  return (
    <div className="flex h-full overflow-hidden relative">
      <div className="flex-1 flex flex-col overflow-y-auto px-8 custom-scrollbar pt-6 pb-24">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <LayoutDashboard size={18} className="text-blue-500" /> Grid Layout
          </h2>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-muted)]">Template:</span>
              <select 
                value={selectedTemplate}
                onChange={(e) => applyTemplate(e.target.value)}
                className="bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-md px-2 py-1 text-xs outline-none text-[var(--color-text-primary)] max-w-[150px]"
              >
                <option value="custom" disabled={selectedTemplate !== 'custom'}>Custom Layout</option>
                <optgroup label="Templates">
                  {accessibleTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <button 
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-lg text-sm text-[var(--color-text-primary)] transition-colors"
            >
              <PanelRight size={16} className="text-blue-500" /> Library
            </button>
          </div>
        </div>

        <div className="border-[4px] border-[var(--color-text-primary)] bg-[var(--color-bg-workspace)] rounded-3xl p-6 min-h-[500px]">
          <div
            ref={gridRef}
            className="grid grid-cols-4 gap-4 relative"
            style={{ gridAutoRows: `${CELL_HEIGHT}px` }}
          >
            {displayElements.filter(el => el.visible).map((el) => {
              const cCol = clampCol(el.col, el.size);
              const isDragging = dragId === el.componentId;

              if (isDragging) {
                const origCol = clampCol(dragRef.current.origCol, el.size);
                const origRow = dragRef.current.origRow || 1;

                return (
                  <React.Fragment key={el.componentId}>
                    {/* Placeholder Outline */}
                    <div
                      className={`${colSpanClass(el.size)} bg-blue-500/10 border-2 border-dashed border-blue-500/50 rounded-xl transition-all duration-200`}
                      style={{
                        gridColumnStart: cCol,
                        gridRowStart: el.row || 1,
                      }}
                    />
                    
                    {/* The actual dragged element */}
                    <div
                      data-comp={el.componentId}
                      className={`${colSpanClass(el.size)} bg-[var(--color-bg-primary)] border-[3px] rounded-xl flex flex-col pt-3 pb-2 px-3 relative group select-none border-blue-500 z-50 shadow-2xl pointer-events-none`}
                      style={{
                        gridColumnStart: origCol,
                        gridRowStart: origRow,
                        transform: `translate(${dragDelta.dx}px, ${dragDelta.dy}px) scale(1.03)`,
                        transition: 'none'
                      }}
                    >
                      <div className="flex items-start justify-between w-full mb-2">
                        <span className="font-bold text-sm md:text-base text-[var(--color-text-primary)] tracking-tight capitalize">
                          {el.componentId.replace(/-/g, ' ')}
                        </span>
                        <div className="flex items-center gap-1">
                          <GripVertical size={16} className="text-[var(--color-text-muted)]" />
                        </div>
                      </div>
                      <div className="flex-1 w-full flex items-center justify-center py-2 px-1">
                        {renderDummyContent(el.componentId)}
                      </div>
                    </div>
                  </React.Fragment>
                );
              }

              return (
                <div
                  key={el.componentId}
                  data-comp={el.componentId}
                  className={`${colSpanClass(el.size)} bg-[var(--color-bg-primary)] border-[3px] rounded-xl flex flex-col pt-3 pb-2 px-3 shadow-sm relative group select-none border-[var(--color-text-primary)] transition-all duration-300`}
                  style={{
                    gridColumnStart: cCol,
                    gridRowStart: el.row || 1,
                    transform: 'scale(1)'
                  }}
                >
                  <div className="flex items-start justify-between w-full mb-2">
                    <span className="font-bold text-sm md:text-base text-[var(--color-text-primary)] tracking-tight capitalize">
                      {el.componentId.replace(/-/g, ' ')}
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => toggleVisibility(el.componentId, e)}
                        className="no-drag opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-[var(--color-bg-secondary)] rounded hover:bg-rose-500/10 hover:text-rose-500 text-[var(--color-text-muted)]"
                        title="Remove Component"
                      >
                        <X size={14} />
                      </button>
                      <div
                        className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                        onPointerDown={(e) => handlePointerDown(e, el)}
                        title="Drag to reposition"
                      >
                        <GripVertical size={16} />
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 w-full flex items-center justify-center py-2 px-1">
                    {renderDummyContent(el.componentId)}
                  </div>
                  
                  <div 
                    className="no-drag absolute bottom-0 right-0 w-6 h-6 flex items-center justify-center cursor-ew-resize text-[var(--color-text-muted)] hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onPointerDown={(e) => handleResizeDown(e, el)}
                    title="Drag to resize"
                  >
                    <Scaling size={12} className="rotate-90" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Side Drawer Library */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-[var(--color-bg-primary)] border-l border-[var(--color-bg-border)] shadow-2xl transform transition-transform duration-300 z-[100] flex flex-col ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 border-b border-[var(--color-bg-border)] flex items-center justify-between">
          <h3 className="font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <PanelRight size={18} className="text-blue-500" /> Component Library
          </h3>
          <button onClick={() => setDrawerOpen(false)} className="p-1.5 hover:bg-[var(--color-bg-secondary)] rounded-md text-[var(--color-text-muted)] transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {availableToAdd.length === 0 ? (
            <div className="text-center text-sm text-[var(--color-text-muted)] mt-10">All components added!</div>
          ) : (
            <div className="flex flex-col gap-3">
              {availableToAdd.map(id => {
                const meta = COMPONENT_REGISTRY[id];
                return (
                  <div 
                    key={id} 
                    className="bg-[var(--color-bg-workspace)] border-2 border-dashed border-[var(--color-bg-border)] rounded-xl p-4 flex items-center justify-between hover:border-blue-500 hover:bg-blue-500/5 transition-all cursor-pointer group" 
                    onClick={() => addComponent(id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-xl opacity-70 group-hover:opacity-100 transition-opacity">{meta?.icon || '📊'}</div>
                      <span className="text-sm font-bold text-[var(--color-text-primary)] capitalize">{meta?.label || id.replace(/-/g, ' ')}</span>
                    </div>
                    <div className="p-1.5 bg-[var(--color-bg-primary)] rounded-md text-[var(--color-text-muted)] group-hover:text-blue-500 group-hover:bg-blue-500/10 transition-colors">
                      <Plus size={16} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 bg-black/20 z-[90] transition-opacity" onClick={() => setDrawerOpen(false)} />
      )}

      <UnsavedChangesBar hasChanges={hasChanges} onReset={handleRevert} onSave={handleSave} isSaving={saving} />
    </div>
  );
}
