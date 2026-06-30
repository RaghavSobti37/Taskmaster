import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, PanelRight, Plus, X, ArrowLeft, GripVertical, Minus } from 'lucide-react';
import {
  useDashboardPreset,
  savedLayoutOptionValue,
  parseSavedLayoutOptionValue,
} from '../../../hooks/queries/dashboard';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges';
import { useAuth } from '../../../contexts/AuthContext';
import {
  COMPONENT_REGISTRY,
  LAYOUT_TEMPLATES,
  getAccessibleComponents,
  getAccessibleTemplates,
  getRecommendedTemplateId,
} from '../../../lib/componentRegistry';
import {
  DASHBOARD_SECTIONS,
  DASHBOARD_LAYOUT_VERSION,
  DEFAULT_SECTION_STATE,
  getDefaultTierElements,
  getWidgetSection,
  normalizeDashboardElements,
  resolveSectionState,
  sectionMaxCols,
  getWidgetGridStyle,
  getSectionGridStyle,
  getWidgetMinHeightClass,
  sortSectionWidgets,
  getElementSection,
  packSectionElements,
  repackDashboardElements,
} from '../../../lib/dashboardSections';
import { DesktopRecommendedBanner, LoadingState, Button } from '../../../components/ui';
import QueryErrorSlot from '../../../components/ui/QueryErrorSlot';
import DashboardCollapsibleSection from '../../../components/dashboard/DashboardCollapsibleSection';
import { useIsMobile } from '../../../hooks/useBreakpoint';
import { isAdminUser } from '../../../utils/departmentPermissions';

const SECTION_PREVIEW_HINTS = {
  'status-strip': 'System health, backups, leave & reimbursement alerts',
  'daily-actions': 'Clock in, calendar, tasks, review queue',
  'team-context': 'Leaderboard, projects today, announcements',
  analytics: 'CRM stats, campaigns, department metrics, PostHog',
  more: 'Notes, pin board, composer, daily missions',
};

const GRID_COLS = 4;

const resolveCollisions = (elements) => repackDashboardElements(elements);

const mergeSectionPacked = (allElements, sectionId, orderedSectionEls) => {
  const packed = packSectionElements(orderedSectionEls, sectionMaxCols(sectionId));
  const packedMap = Object.fromEntries(packed.map((e) => [e.componentId, e]));
  return allElements.map((e) => packedMap[e.componentId] || e);
};

const buildSavePayload = (elements) => {
  const hidden = elements.filter((el) => el.visible === false);
  const visible = elements.filter((el) => el.visible !== false);
  const payload = [];
  let order = 0;

  for (const section of DASHBOARD_SECTIONS) {
    const sectionItems = visible
      .filter((el) => getElementSection(el) === section.id)
      .sort((a, b) => (a.row - b.row) || (a.col - b.col) || (a.order ?? 0) - (b.order ?? 0));

    sectionItems.forEach((el) => {
      order += 1;
      payload.push({
        componentId: el.componentId,
        section: section.id,
        size: el.size || COMPONENT_REGISTRY[el.componentId]?.defaultSize || '1',
        col: el.col ?? 1,
        row: el.row ?? 1,
        order,
        visible: true,
      });
    });
  }

  hidden.forEach((el) => {
    payload.push({
      componentId: el.componentId,
      section: el.section || getWidgetSection(el.componentId),
      size: el.size || '1',
      col: el.col ?? 1,
      row: el.row ?? 99,
      order: 99999,
      visible: false,
    });
  });

  return payload;
};

export default function DashboardCustomizationTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const permissionPreset = useMemo(() => {
    if (isAdminUser(user)) return 'admin';
    return user?.departmentId?.permissionPreset || user?.departmentId?.slug || 'standard';
  }, [user]);

  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [originalSnapshot, setOriginalSnapshot] = useState('');
  const {
    data: dashboardPreset,
    isLoading: presetLoading,
    isError: presetError,
    error: presetErr,
    refetch: refetchPreset,
  } = useDashboardPreset();
  const [dashboardElements, setDashboardElements] = useState([]);
  const [sectionState, setSectionState] = useState({ ...DEFAULT_SECTION_STATE });
  const [previewCollapsed, setPreviewCollapsed] = useState({ ...DEFAULT_SECTION_STATE });
  const [selectedTemplate, setSelectedTemplate] = useState('custom');
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [layoutNameInput, setLayoutNameInput] = useState('');
  const [saveError, setSaveError] = useState('');
  const templateInitRef = useRef(false);

  const savedLayouts = useMemo(
    () => (dashboardPreset?.presets || []).filter((p) => p?.name && Array.isArray(p.elements)),
    [dashboardPreset?.presets]
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dragState, setDragState] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);

  useEffect(() => {
    if (presetLoading) return;
    const raw = dashboardPreset?.elements?.length
      ? dashboardPreset.elements
      : getDefaultTierElements(permissionPreset);
    let init = normalizeDashboardElements(raw, permissionPreset).map((el, i) => ({
      ...el,
      section: el.section || getWidgetSection(el.componentId),
      col: el.col ?? ((i % GRID_COLS) + 1),
      row: el.row ?? (Math.floor(i / GRID_COLS) + 1),
    }));
    init = resolveCollisions(init);
    const initSections = resolveSectionState(dashboardPreset?.sectionState);
    setDashboardElements(init);
    setSectionState(initSections);
    setPreviewCollapsed({ ...initSections });
    setOriginalSnapshot(JSON.stringify({ elements: init, sectionState: initSections }));
    if (dashboardPreset?.name) setLayoutNameInput(dashboardPreset.name);

    if (!templateInitRef.current) {
      const presets = dashboardPreset?.presets || [];
      const currentName = dashboardPreset?.name;
      const savedMatch = presets.find((p) => p.name === currentName);
      if (savedMatch) {
        setSelectedTemplate(savedLayoutOptionValue(savedMatch.name));
      } else if (currentName) {
        const builtin = LAYOUT_TEMPLATES.find((t) => t.name === currentName);
        if (builtin) setSelectedTemplate(builtin.id);
      }
      templateInitRef.current = true;
    }
  }, [dashboardPreset, permissionPreset, presetLoading]);

  const applyTemplate = (templateId) => {
    if (templateId === 'custom') {
      setSelectedTemplate('custom');
      return;
    }

    const savedName = parseSavedLayoutOptionValue(templateId);
    if (savedName) {
      const saved = savedLayouts.find(
        (p) => p.name.toLowerCase() === savedName.toLowerCase()
      );
      if (!saved?.elements?.length) return;

      const accessibleCompIds = getAccessibleComponents(permissionPreset);
      let elements = saved.elements
        .filter((el) => accessibleCompIds.includes(el.componentId))
        .map((el) => ({
          ...el,
          col: el.col ?? 1,
          row: el.row ?? 1,
          visible: el.visible !== false,
        }));

      const savedCompIds = elements.map((e) => e.componentId);
      dashboardElements.forEach((existing) => {
        if (!savedCompIds.includes(existing.componentId)) {
          elements.push({ ...existing, visible: false, col: 1, row: 99 });
        }
      });

      const packed = resolveCollisions(elements);
      setDashboardElements(packed);
      setSelectedTemplate(templateId);
      return;
    }

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

  const handleResetToDepartment = () => {
    const defaults = getDefaultTierElements(permissionPreset).map((el, i) => ({
      ...el,
      col: el.col ?? ((i % GRID_COLS) + 1),
      row: el.row ?? (Math.floor(i / GRID_COLS) + 1),
    }));
    const packed = resolveCollisions(defaults);
    setDashboardElements(packed);
    setSectionState({ ...DEFAULT_SECTION_STATE });
    setPreviewCollapsed({ ...DEFAULT_SECTION_STATE });
    setSelectedTemplate(getRecommendedTemplateId(permissionPreset));
  };

  const setSectionOpenByDefault = (sectionId, openByDefault) => {
    setSectionState((prev) => ({ ...prev, [sectionId]: !openByDefault }));
  };

  const setPreviewSectionCollapsed = (sectionId, collapsed) => {
    setPreviewCollapsed((prev) => ({ ...prev, [sectionId]: collapsed }));
  };

  const renderOpenByDefaultControl = (sectionId) => (
    <label className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)] cursor-pointer whitespace-nowrap">
      <input
        type="checkbox"
        className="rounded"
        checked={!sectionState[sectionId]}
        onChange={(e) => setSectionOpenByDefault(sectionId, e.target.checked)}
      />
      Open by default
    </label>
  );

  const toggleVisibility = (componentId, e) => {
    if (e) e.stopPropagation();
    setDashboardElements((prev) =>
      repackDashboardElements(
        prev.map((el) =>
          el.componentId === componentId ? { ...el, visible: !el.visible } : el
        )
      )
    );
    setSelectedTemplate('custom');
  };

  const cycleWidgetSize = (componentId, delta) => {
    setDashboardElements((prev) => {
      const target = prev.find((e) => e.componentId === componentId);
      if (!target) return prev;
      const sectionId = getElementSection(target);
      const maxCols = sectionMaxCols(sectionId);
      const current = Math.min(parseInt(target.size, 10) || 1, maxCols);
      const next = Math.min(maxCols, Math.max(1, current + delta));
      if (next === current) return prev;
      return repackDashboardElements(
        prev.map((e) =>
          e.componentId === componentId ? { ...e, size: String(next) } : e
        )
      );
    });
    setSelectedTemplate('custom');
  };

  const handleDragStart = (componentId, sectionId) => (e) => {
    setDragState({ componentId, sectionId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', componentId);
  };

  const handleDragEnd = () => {
    setDragState(null);
    setDropTargetId(null);
  };

  const handleDropOnWidget = (targetId, sectionId) => (e) => {
    e.preventDefault();
    setDropTargetId(null);
    if (!dragState || dragState.sectionId !== sectionId) return;
    const fromId = dragState.componentId;
    if (fromId === targetId) return;

    setDashboardElements((prev) => {
      const sectionEls = prev
        .filter((el) => el.visible !== false && getElementSection(el) === sectionId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.row - b.row) || (a.col - b.col));
      const fromIdx = sectionEls.findIndex((el) => el.componentId === fromId);
      const toIdx = sectionEls.findIndex((el) => el.componentId === targetId);
      if (fromIdx < 0 || toIdx < 0) return prev;

      const reordered = [...sectionEls];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      const withOrder = reordered.map((el, i) => ({ ...el, order: i + 1 }));
      return mergeSectionPacked(prev, sectionId, withOrder);
    });
    setDragState(null);
    setSelectedTemplate('custom');
  };

  const addComponent = (componentId) => {
    const meta = COMPONENT_REGISTRY[componentId];
    if (!meta) return;
    const section = getWidgetSection(componentId);
    setDashboardElements((prev) => {
      const exists = prev.find((p) => p.componentId === componentId);
      const sizeStr = meta.defaultSize || '1';
      const sectionOrder = prev
        .filter((p) => p.visible && getElementSection(p) === section)
        .length;

      let next;
      if (exists) {
        next = prev.map((p) => (p.componentId === componentId
          ? {
            ...p,
            visible: true,
            section,
            order: sectionOrder + 1,
          }
          : p));
      } else {
        next = [
          ...prev,
          {
            componentId,
            size: sizeStr,
            col: 1,
            row: 1,
            order: sectionOrder + 1,
            visible: true,
            section,
          },
        ];
      }
      return repackDashboardElements(next);
    });
    setSelectedTemplate('custom');

    setTimeout(() => {
      const el = document.querySelector(`[data-comp="${componentId}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const persistLayout = async (layoutName) => {
    const trimmed = layoutName?.trim();
    if (!trimmed) {
      setSaveError('Enter a layout name');
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      const elementsToSave = buildSavePayload(dashboardElements);
      await axios.post('/api/customization/dashboard/preset', {
        layoutName: trimmed,
        name: trimmed,
        department: 'custom',
        layoutVersion: DASHBOARD_LAYOUT_VERSION,
        sectionState,
        elements: elementsToSave,
      });
      setOriginalSnapshot(JSON.stringify({ elements: dashboardElements, sectionState }));
      setSelectedTemplate(savedLayoutOptionValue(trimmed));
      setNameModalOpen(false);
      setLayoutNameInput('');
      await queryClient.invalidateQueries({ queryKey: ['dashboardPreset'] });
    } catch (error) {
      const msg = error.response?.data?.error || error.message || 'Failed to save layout';
      setSaveError(msg);
      console.error('Error saving preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const resolveSaveLayoutName = () => {
    const savedName = parseSavedLayoutOptionValue(selectedTemplate);
    if (savedName) return savedName;
    const builtin = LAYOUT_TEMPLATES.find((t) => t.id === selectedTemplate);
    if (builtin) return builtin.name;
    return null;
  };

  const handleSave = async () => {
    const layoutName = resolveSaveLayoutName();
    if (layoutName) {
      await persistLayout(layoutName);
      return;
    }
    setLayoutNameInput('');
    setSaveError('');
    setNameModalOpen(true);
  };

  const handleNameModalSubmit = (e) => {
    e?.preventDefault();
    persistLayout(layoutNameInput);
  };

  const handleRevert = () => {
    const parsed = JSON.parse(originalSnapshot || '{}');
    if (parsed.elements) setDashboardElements(parsed.elements);
    if (parsed.sectionState) {
      setSectionState(parsed.sectionState);
      setPreviewCollapsed({ ...parsed.sectionState });
    }
    setSelectedTemplate('custom');
  };

  const hasChanges = JSON.stringify({ elements: dashboardElements, sectionState })
    !== originalSnapshot;

  useUnsavedChanges({
    hasChanges,
    onSave: handleSave,
    onCancel: handleRevert,
    isSaving: saving,
  });

  const renderDummyContent = (id) => {
    switch (id) {
      case 'daily-missions': return (
        <div className="space-y-2 w-full">
          <div className="h-2 w-full bg-emerald-500/30 rounded"></div>
          <div className="h-2 w-4/5 bg-emerald-500/20 rounded"></div>
          <div className="h-2 w-3/5 bg-emerald-500/10 rounded"></div>
        </div>
      );
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
        <div className="flex gap-2 w-full max-w-full items-end justify-center overflow-hidden">
          {[
            { h: 'h-8', c: 'bg-blue-500', label: 'Web' },
            { h: 'h-6', c: 'bg-blue-400', label: 'API' },
            { h: 'h-4', c: 'bg-blue-300', label: 'App' },
            { h: 'h-5', c: 'bg-emerald-400', label: 'CRM' },
          ].map(({ h, c, label }) => (
            <div key={label} className="flex flex-col items-center gap-0.5 min-w-0 flex-1 max-w-[2.25rem]">
              <div className={`w-full max-w-7 ${c} rounded-t ${h}`} />
              <div className="text-[8px] text-[var(--color-text-muted)] truncate w-full text-center">{label}</div>
            </div>
          ))}
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
        <div className="space-y-1.5 w-full">
          <div className="h-5 bg-amber-500/10 border border-amber-500/20 rounded px-2 flex items-center justify-between">
            <div className="h-2 w-1/2 bg-amber-500/50 rounded" />
            <div className="h-2 w-8 bg-amber-500/30 rounded" />
          </div>
          <div className="h-4 bg-[var(--color-bg-secondary)] rounded px-2 flex items-center"><div className="h-1.5 w-2/3 bg-[var(--color-text-muted)]/30 rounded" /></div>
        </div>
      );
      case 'invoice-alerts': return (
        <div className="space-y-1.5 w-full">
          <div className="h-5 bg-blue-500/10 border border-blue-500/20 rounded px-2 flex items-center justify-between">
            <div className="h-2 w-1/2 bg-blue-500/50 rounded" />
            <div className="h-2 w-10 bg-blue-500/30 rounded" />
          </div>
          <div className="h-4 bg-[var(--color-bg-secondary)] rounded px-2 flex items-center"><div className="h-1.5 w-1/2 bg-[var(--color-text-muted)]/30 rounded" /></div>
        </div>
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
      case 'last-backup': return (
        <div className="w-full space-y-2"><div className="h-3 w-2/3 bg-emerald-500/40 rounded"></div><div className="h-2 w-full bg-[var(--color-text-muted)] opacity-30 rounded"></div><div className="flex gap-1"><div className="h-4 w-12 bg-[var(--color-bg-secondary)] rounded"></div><div className="h-4 w-14 bg-[var(--color-bg-secondary)] rounded"></div></div></div>
      );
      case 'render-logs':
      case 'render-logs-production':
      case 'render-logs-staging-api':
      case 'render-logs-staging-nest': return (
        <div className="w-full flex flex-col items-center justify-center gap-2 py-1">
          <div className="h-8 w-full rounded bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
            <div className="h-2 w-2/3 bg-teal-500/50 rounded" />
          </div>
          <span className="text-[9px] text-teal-600/80 font-semibold">Render logs</span>
        </div>
      );
      case 'posthog-dashboard': return (
        <div className="w-full flex flex-col items-center justify-center gap-2 py-1">
          <div className="h-8 w-full rounded bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
            <div className="h-2 w-2/3 bg-violet-500/50 rounded" />
          </div>
          <span className="text-[9px] text-violet-600/80 font-semibold">PostHog</span>
        </div>
      );
      case 'artist-calendar': return (
        <div className="space-y-1.5 w-full"><div className="h-6 bg-purple-500/20 rounded flex items-center px-2"><div className="h-2 w-1/2 bg-purple-500/60 rounded"></div></div><div className="h-6 bg-pink-500/20 rounded flex items-center px-2"><div className="h-2 w-1/3 bg-pink-500/60 rounded"></div></div></div>
      );
      default: return <div className="w-full h-8 bg-[var(--color-bg-secondary)] rounded"></div>;
    }
  };

  const renderEditorWidgetCard = (el, sectionId) => {
    const maxCols = sectionMaxCols(sectionId);
    const size = Math.min(parseInt(el.size, 10) || 1, maxCols);
    const isDragging = dragState?.componentId === el.componentId;
    const isDropTarget = dropTargetId === el.componentId;

    return (
      <div
        key={el.componentId}
        data-comp={el.componentId}
        onDragOver={(e) => {
          e.preventDefault();
          if (dragState?.sectionId === sectionId) setDropTargetId(el.componentId);
        }}
        onDragLeave={() => setDropTargetId(null)}
        onDrop={handleDropOnWidget(el.componentId, sectionId)}
        style={getWidgetGridStyle(el, sectionId)}
        className={`${getWidgetMinHeightClass(sectionId)} w-full min-h-0 self-stretch overflow-hidden bg-[var(--color-bg-primary)] rounded-[var(--radius-atomic)] flex flex-col pt-3 pb-2 px-3 relative group box-border transition-[box-shadow,opacity] ${
          isDragging ? 'opacity-40' : ''
        } ${isDropTarget ? 'ring-2 ring-blue-500' : ''}`}
      >
        <div className="flex items-start justify-between w-full mb-2 gap-2 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span
              draggable
              onDragStart={handleDragStart(el.componentId, sectionId)}
              onDragEnd={handleDragEnd}
              className="cursor-grab active:cursor-grabbing p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] shrink-0 touch-none"
              title="Drag to reorder"
            >
              <GripVertical size={14} />
            </span>
            <span className="font-bold text-sm text-[var(--color-text-primary)] tracking-tight truncate">
              {COMPONENT_REGISTRY[el.componentId]?.label || el.componentId.replace(/-/g, ' ')}
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => toggleVisibility(el.componentId, e)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-[var(--color-bg-secondary)] rounded hover:bg-rose-500/10 hover:text-rose-500 text-[var(--color-text-muted)] shrink-0"
            title="Remove from dashboard"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 min-h-0 w-full flex items-center justify-center py-2 px-1 overflow-hidden pointer-events-none">
          {renderDummyContent(el.componentId)}
        </div>
        <div
          className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 rounded-md border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/95 shadow-sm"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            disabled={size <= 1}
            onClick={(e) => {
              e.stopPropagation();
              cycleWidgetSize(el.componentId, -1);
            }}
            className="p-1 rounded-l-md hover:bg-[var(--color-bg-primary)] disabled:opacity-30 text-[var(--color-text-muted)]"
            title="Narrower"
            aria-label="Make widget narrower"
          >
            <Minus size={12} />
          </button>
          <span className="text-[9px] font-bold tabular-nums px-1 min-w-[1.25rem] text-center text-[var(--color-text-primary)]">
            {size}
          </span>
          <button
            type="button"
            disabled={size >= maxCols}
            onClick={(e) => {
              e.stopPropagation();
              cycleWidgetSize(el.componentId, 1);
            }}
            className="p-1 rounded-r-md hover:bg-[var(--color-bg-primary)] disabled:opacity-30 text-[var(--color-text-muted)]"
            title="Wider"
            aria-label="Make widget wider"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>
    );
  };

  const renderSectionGrid = (sectionId, widgets) => (
    <div
      data-section-grid={sectionId}
      className="grid w-full gap-3 items-stretch"
      style={getSectionGridStyle(sectionId)}
      onDragOver={(e) => e.preventDefault()}
    >
      {widgets.map((el) => renderEditorWidgetCard(el, sectionId))}
    </div>
  );

  const accessibleTemplates = getAccessibleTemplates(permissionPreset);
  const accessibleComponents = getAccessibleComponents(permissionPreset);
  
  const availableToAdd = accessibleComponents.filter(id => {
    const existing = dashboardElements.find(e => e.componentId === id);
    return !existing || !existing.visible;
  });

  const libraryBySection = useMemo(() => {
    const buckets = DASHBOARD_SECTIONS.map((section) => ({
      ...section,
      items: availableToAdd.filter((id) => getWidgetSection(id) === section.id),
    }));
    return buckets.filter((b) => b.items.length > 0);
  }, [availableToAdd]);

  const elementsGroupedBySection = useMemo(() => {
    const groups = Object.fromEntries(DASHBOARD_SECTIONS.map((s) => [s.id, []]));
    dashboardElements
      .filter((el) => el.visible)
      .forEach((el) => {
        const sid = el.section || getWidgetSection(el.componentId);
        if (groups[sid]) groups[sid].push(el);
      });
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.row - b.row) || (a.col - b.col));
    });
    return groups;
  }, [dashboardElements]);

  return (
    <div className="flex h-full overflow-hidden relative">
      <div className="flex-1 flex flex-col overflow-y-auto px-4 md:px-8 custom-scrollbar pt-6 pb-24">
        <DesktopRecommendedBanner className="mb-4" message="Section layout editing works best on a desktop screen." />
        <QueryErrorSlot
          isError={presetError}
          error={presetErr}
          onRetry={() => refetchPreset()}
          fallback="Failed to load dashboard layout"
          className="mb-4"
        />
        <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 ${isMobile ? 'pointer-events-none opacity-50' : ''}`}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-lg border border-[var(--color-bg-border)] hover:bg-[var(--color-bg-secondary)]"
              aria-label="Back to dashboard"
            >
              <ArrowLeft size={16} />
            </button>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <LayoutDashboard size={18} className="text-blue-500" /> Dashboard layout
            </h2>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex flex-col gap-0.5">
              <label htmlFor="dashboard-template-select" className="text-xs text-[var(--color-text-muted)]">
                Layout template
              </label>
              <select
                id="dashboard-template-select"
                value={selectedTemplate}
                onChange={(e) => applyTemplate(e.target.value)}
                className="bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-md px-2 py-1.5 text-xs outline-none text-[var(--color-text-primary)] max-w-[200px]"
              >
                <option value="custom">Custom layout (save to name)</option>
                {savedLayouts.length > 0 && (
                  <optgroup label="My layouts">
                    {savedLayouts.map((p) => (
                      <option key={p.name} value={savedLayoutOptionValue(p.name)}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Templates">
                  {accessibleTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={handleResetToDepartment}>
              Reset defaults
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!hasChanges || saving}
              onClick={handleSave}
            >
              {saving ? 'Saving…' : 'Save layout'}
            </Button>
            <button 
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-lg text-sm text-[var(--color-text-primary)] transition-colors"
            >
              <PanelRight size={16} className="text-blue-500" /> Library
            </button>
          </div>
        </div>

        <p className="mb-4 text-xs text-[var(--color-text-muted)] leading-relaxed max-w-3xl">
          Drag the grip to reorder. Use <strong>− / +</strong> on the bottom-right corner to narrow or
          widen a widget. Expand a section to preview it — that does not change <strong>Open by default</strong>.
        </p>

        {presetLoading && dashboardElements.length === 0 ? (
          <LoadingState showPhrase className="min-h-[400px] rounded-3xl" />
        ) : (
        <div
          className={`w-full max-w-full box-border bg-[var(--color-bg-workspace)] rounded-3xl p-4 sm:p-6 space-y-6 min-h-[min(400px,50vh)] ${isMobile ? 'pointer-events-none opacity-50' : ''}`}
        >
          {DASHBOARD_SECTIONS.map((section) => {
            const widgets = elementsGroupedBySection[section.id] || [];

            if (!section.collapsible) {
              return (
                <div key={section.id} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                      {section.sectionLabel || section.title.toUpperCase()}
                    </p>
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                      Always expanded on dashboard
                    </span>
                  </div>
                  {widgets.length > 0 ? (
                    renderSectionGrid(section.id, widgets)
                  ) : (
                    <p className="text-xs text-[var(--color-text-muted)] italic py-1">
                      No widgets in this section — open Library to add.
                    </p>
                  )}
                </div>
              );
            }

            return (
              <DashboardCollapsibleSection
                key={section.id}
                title={section.title}
                subtitle={SECTION_PREVIEW_HINTS[section.id] || section.collapsedLabel}
                sectionLabel={section.id === 'analytics' ? section.sectionLabel : undefined}
                strip={section.id === 'status-strip'}
                collapsed={!!previewCollapsed[section.id]}
                onCollapsedChange={(v) => setPreviewSectionCollapsed(section.id, v)}
                trailing={renderOpenByDefaultControl(section.id)}
              >
                {widgets.length > 0 ? (
                  renderSectionGrid(section.id, widgets)
                ) : (
                  <p className="text-xs text-[var(--color-text-muted)] italic py-2">
                    No widgets in this section — open Library to add.
                  </p>
                )}
              </DashboardCollapsibleSection>
            );
          })}
        </div>
        )}
      </div>

      {nameModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleNameModalSubmit}
            className="w-full max-w-sm rounded-2xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] p-5 shadow-2xl"
          >
            <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">Name your layout</h3>
            <p className="text-xs text-[var(--color-text-muted)] mb-4">
              Saved layouts appear under <strong>My layouts</strong> in the template dropdown.
            </p>
            <input
              type="text"
              value={layoutNameInput}
              onChange={(e) => setLayoutNameInput(e.target.value)}
              placeholder="e.g. Sales morning"
              maxLength={64}
              autoFocus
              className="w-full rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-action-primary)]"
            />
            {saveError && (
              <p className="mt-2 text-xs text-rose-500">{saveError}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setNameModalOpen(false);
                  setSaveError('');
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !layoutNameInput.trim()}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[var(--color-action-primary)] text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save layout'}
              </button>
            </div>
          </form>
        </div>
      )}

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
          <p className="text-[11px] text-[var(--color-text-muted)] mb-4 leading-relaxed">
            Tap a widget to add it to your grid. Items are grouped by the section they appear in on
            your dashboard.
          </p>
          {availableToAdd.length === 0 ? (
            <div className="text-center text-sm text-[var(--color-text-muted)] mt-10">All components added!</div>
          ) : (
            <div className="flex flex-col gap-5">
              {libraryBySection.map((section) => (
                <div key={section.id}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
                    {section.title}
                  </p>
                  <div className="flex flex-col gap-2">
                    {section.items.map((id) => {
                      const meta = COMPONENT_REGISTRY[id];
                      return (
                        <div
                          key={id}
                          className="bg-[var(--color-bg-workspace)] border-2 border-dashed border-[var(--color-bg-border)] rounded-xl p-3 flex items-center justify-between hover:border-[var(--color-action-primary)] hover:bg-[var(--color-action-primary)]/5 transition-all cursor-pointer group"
                          onClick={() => addComponent(id)}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="text-xl opacity-70 group-hover:opacity-100 transition-opacity shrink-0">
                              {meta?.icon || '📊'}
                            </div>
                            <div className="min-w-0">
                              <span className="text-sm font-bold text-[var(--color-text-primary)] block truncate">
                                {meta?.label || id.replace(/-/g, ' ')}
                              </span>
                              {meta?.description && (
                                <span className="text-[11px] text-[var(--color-text-muted)] line-clamp-2">
                                  {meta.description}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="p-1.5 bg-[var(--color-bg-primary)] rounded-md text-[var(--color-text-muted)] group-hover:text-blue-500 group-hover:bg-blue-500/10 transition-colors shrink-0">
                            <Plus size={16} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 bg-black/20 z-[90] transition-opacity" onClick={() => setDrawerOpen(false)} />
      )}

    </div>
  );
}
