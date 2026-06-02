import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { GripVertical, Eye, EyeOff, Plus, Trash2, Edit2, Check, X, RotateCcw } from 'lucide-react';
import { Button, DesktopRecommendedBanner } from '../../../components/ui';
import { useIsMobile } from '../../../hooks/useBreakpoint';
import { useAuth } from '../../../contexts/AuthContext';
import { useConfirm } from '../../../contexts/confirmContext';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges';
import { useNavbarPreferences } from '../../../hooks/useTaskmasterQueries';
import { hasPageAccess } from '../../../utils/departmentPermissions';
import { filterNavGroupsForUser } from '../../../utils/navPageAccess';
import { DEFAULT_NAVBAR_GROUPS, sortNavbarGroups } from '../../../utils/defaultNavbarGroups';

function normalizeNavbarGroups(rawGroups, user) {
  const sorted = sortNavbarGroups(rawGroups?.length ? rawGroups : DEFAULT_NAVBAR_GROUPS);
  return filterNavGroupsForUser(sorted, user, hasPageAccess);
}

export default function SidebarCustomizationTab() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { confirm } = useConfirm();
  const { data: navbarPreferences, isLoading, isError, refetch } = useNavbarPreferences();
  const [groups, setGroups] = useState([]);
  const [saving, setSaving] = useState(false);
  const [originalGroups, setOriginalGroups] = useState([]);

  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  const applyGroups = useCallback((rawGroups) => {
    const next = normalizeNavbarGroups(rawGroups, user);
    setGroups(next);
    setOriginalGroups(JSON.parse(JSON.stringify(next)));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    applyGroups(navbarPreferences?.groups);
  }, [navbarPreferences, user, applyGroups]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post('/api/customization/navbar', { groups });
      setOriginalGroups(JSON.parse(JSON.stringify(groups)));
      // Instead of window.reload, we could just let state persist, but reload ensures navbar picks it up immediately.
      window.location.reload();
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const response = await axios.post('/api/customization/navbar/reset');
      applyGroups(response.data.groups);
      await refetch();
      window.location.reload();
    } catch (error) {
      console.error('Error resetting preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = () => {
    setGroups(JSON.parse(JSON.stringify(originalGroups)));
  };

  const togglePageVisibility = (groupId, path) => setGroups(groups.map(g => g.id !== groupId ? g : { ...g, pages: g.pages.map(p => p.path === path ? { ...p, visible: !p.visible } : p) }));
  const toggleGroupVisibility = (groupId) => setGroups(groups.map(g => g.id === groupId ? { ...g, visible: !g.visible } : g));

  const handleCreateGroup = () => {
    const newGroupId = 'custom-' + Date.now();
    setGroups([...groups, { id: newGroupId, title: 'New Custom Group', order: groups.length + 1, visible: true, isCustom: true, pages: [] }]);
    setEditingGroupId(newGroupId);
    setEditTitle('New Custom Group');
  };

  const handleDeleteGroup = async (groupId) => {
    const groupToDelete = groups.find(g => g.id === groupId);
    if (!groupToDelete || groupToDelete.pages.length > 0) {
      await confirm({
        title: 'Cannot delete group',
        message: 'Move all pages out of this group before deleting.',
        type: 'warning',
        confirmLabel: 'OK',
        cancelLabel: 'Close',
      });
      return;
    }
    setGroups(groups.filter(g => g.id !== groupId));
  };

  const saveGroupTitle = (groupId) => {
    setGroups(groups.map(g => g.id === groupId ? { ...g, title: editTitle } : g));
    setEditingGroupId(null);
  };

  const movePageToGroup = (pagePath, fromGroupId, toGroupId) => {
    let pageToMove = null;
    const newGroups = groups.map(g => {
      if (g.id === fromGroupId) {
        pageToMove = g.pages.find(p => p.path === pagePath);
        return { ...g, pages: g.pages.filter(p => p.path !== pagePath) };
      }
      return g;
    });
    if (!pageToMove) return;
    setGroups(newGroups.map(g => g.id === toGroupId ? { ...g, pages: [...g.pages, pageToMove] } : g));
  };

  const handleReorderGroups = (newOrder) => setGroups(newOrder);
  const handleReorderPages = (groupId, newPagesOrder) => setGroups(groups.map(g => g.id === groupId ? { ...g, pages: newPagesOrder } : g));

  const hasChanges = JSON.stringify(groups) !== JSON.stringify(originalGroups);

  useUnsavedChanges({
    hasChanges,
    onSave: handleSave,
    onCancel: handleRevert,
    isSaving: saving,
  });

  return (
    <div className="flex flex-col h-full overflow-hidden pb-24">
      <div className="flex-1 overflow-y-auto px-6 md:px-8 py-6 custom-scrollbar">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-lg font-bold text-[var(--color-text-primary)]">Sidebar Layout</h1>
          </div>
          <Button size="sm" variant="outline" onClick={handleReset} disabled={saving} className="gap-2">
            <RotateCcw size={14} /> Reset to defaults
          </Button>
        </div>

        <DesktopRecommendedBanner className="mb-4" message="Sidebar drag-and-drop customization works best on desktop." />

        {isLoading && (
          <p className="text-sm text-[var(--color-text-muted)] py-12 text-center">Loading sidebar layout…</p>
        )}

        {isError && !isLoading && groups.length === 0 && (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-[var(--color-text-muted)]">Could not load sidebar preferences.</p>
            <Button size="sm" onClick={() => refetch()}>Retry</Button>
          </div>
        )}

        {!isLoading && groups.length > 0 && (
        <div className={`flex flex-col lg:flex-row gap-6 ${isMobile ? 'pointer-events-none opacity-50' : ''}`}>
          {/* LEFT — Page ordering within groups */}
          <div className="flex-1 min-w-0">
            <section>
              <Reorder.Group axis="y" values={groups} onReorder={handleReorderGroups} className="space-y-4">
                <AnimatePresence>
                  {groups.map((group) => (
                    <Reorder.Item key={group.id} value={group} className="bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] overflow-hidden group/item">
                      {/* Group header */}
                      <div className="flex items-center gap-3 px-3 py-2.5 bg-[var(--color-bg-secondary)] border-b border-[var(--color-bg-border)]">
                        <div className="cursor-grab active:cursor-grabbing p-1 text-[var(--color-text-muted)] hover:text-blue-500 hover:bg-blue-500/10 rounded transition-colors">
                          <GripVertical size={16} />
                        </div>

                        {editingGroupId === group.id ? (
                          <div className="flex flex-1 gap-2 items-center">
                            <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] px-2 py-1 rounded-lg text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold" autoFocus onKeyDown={(e) => e.key === 'Enter' && saveGroupTitle(group.id)} />
                            <button onClick={() => saveGroupTitle(group.id)} className="p-1 text-green-500 bg-green-500/10 hover:bg-green-500/20 rounded-lg transition-colors"><Check size={14} /></button>
                            <button onClick={() => setEditingGroupId(null)} className="p-1 text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors"><X size={14} /></button>
                          </div>
                        ) : (
                          <div className="flex-1 font-bold text-[14px] text-[var(--color-text-primary)] tracking-wide flex items-center gap-2">
                            {group.title}
                            {group.isCustom && (
                              <button onClick={() => { setEditingGroupId(group.id); setEditTitle(group.title); }} className="text-[var(--color-text-muted)] hover:text-blue-500 opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 rounded-md hover:bg-[var(--color-bg-border)]"><Edit2 size={12} /></button>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-1.5">
                          <button onClick={() => toggleGroupVisibility(group.id)} className="p-1.5 rounded-lg hover:bg-[var(--color-bg-workspace)] transition-colors" title="Toggle Group Visibility">
                            {group.visible ? <Eye size={16} className="text-blue-500" /> : <EyeOff size={16} className="text-[var(--color-text-muted)]" />}
                          </button>
                          {group.isCustom && group.pages.length === 0 && (
                            <button onClick={() => handleDeleteGroup(group.id)} className="p-1.5 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 text-[var(--color-text-muted)] transition-colors" title="Delete Group">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Pages — compact single-line rows */}
                      <div className="bg-[var(--color-bg-primary)]">
                        {group.pages.length === 0 ? (
                          <div className="text-xs text-[var(--color-text-muted)] py-4 text-center border-2 border-dashed border-[var(--color-bg-border)] rounded-lg m-2 bg-[var(--color-bg-workspace)]/50">
                            Empty — move pages here via dropdown
                          </div>
                        ) : (
                          <Reorder.Group axis="y" values={group.pages} onReorder={(newPages) => handleReorderPages(group.id, newPages)} className="divide-y divide-[var(--color-bg-border)]">
                            {group.pages.map((page) => (
                              <Reorder.Item key={page.path} value={page} className="cursor-grab active:cursor-grabbing flex items-center gap-2 px-3 py-2 hover:bg-[var(--color-bg-workspace)] transition-colors group/page">
                                <GripVertical className="w-4 h-4 text-gray-400 shrink-0" />
                                {/* Label + path inline */}
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className="font-semibold text-[13px] text-[var(--color-text-primary)] truncate">{page.label}</span>
                                  <span className="text-[11px] text-[var(--color-text-muted)] font-mono shrink-0">{page.path}</span>
                                </div>
                                {/* Move + visibility */}
                                <div className="flex items-center gap-2 shrink-0">
                                  <select
                                    className="text-[11px] font-medium bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] px-2 py-1 outline-none text-[var(--color-text-primary)] hover:border-[var(--color-action-primary)] transition-colors cursor-pointer"
                                    value={group.id}
                                    onChange={(e) => movePageToGroup(page.path, group.id, e.target.value)}
                                  >
                                    {groups.map(g => <option key={g.id} value={g.id}>→ {g.title}</option>)}
                                  </select>
                                  <button onClick={() => togglePageVisibility(group.id, page.path)} className="p-1 hover:bg-[var(--color-bg-secondary)] rounded transition-all">
                                    {page.visible ? <Eye className="w-3.5 h-3.5 text-blue-500" /> : <EyeOff className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />}
                                  </button>
                                </div>
                              </Reorder.Item>
                            ))}
                          </Reorder.Group>
                        )}
                      </div>
                    </Reorder.Item>
                  ))}
                </AnimatePresence>
              </Reorder.Group>
            </section>
          </div>

          {/* RIGHT — Group management panel */}
          <div className="w-full lg:w-72 shrink-0 lg:sticky lg:top-0">
            <div className="bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] overflow-hidden">
              <div className="px-4 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-bg-border)]">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Tab Groups</h3>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Manage sidebar sections</p>
              </div>
              <div className="p-3 space-y-2">
                {groups.map((group) => (
                  <div key={group.id} className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${group.visible ? 'border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]' : 'border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] opacity-50'}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${group.visible ? 'bg-blue-500' : 'bg-gray-500'}`} />
                      <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate">{group.title}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">({group.pages.length})</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => toggleGroupVisibility(group.id)} className="p-1 rounded hover:bg-[var(--color-bg-secondary)] transition-colors">
                        {group.visible ? <Eye size={12} className="text-blue-500" /> : <EyeOff size={12} className="text-[var(--color-text-muted)]" />}
                      </button>
                      {group.isCustom && (
                        <>
                          <button onClick={() => { setEditingGroupId(group.id); setEditTitle(group.title); }} className="p-1 rounded hover:bg-[var(--color-bg-secondary)] transition-colors text-[var(--color-text-muted)] hover:text-blue-500">
                            <Edit2 size={12} />
                          </button>
                          {group.pages.length === 0 && (
                            <button onClick={() => handleDeleteGroup(group.id)} className="p-1 rounded hover:bg-rose-500/10 text-[var(--color-text-muted)] hover:text-rose-500 transition-colors">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 pt-0">
                <Button size="sm" onClick={handleCreateGroup} variant="secondary" className="w-full gap-2 rounded-[var(--radius-atomic)] text-xs">
                  <Plus size={14} /> Add Custom Group
                </Button>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

    </div>
  );
}


// Performance Optimization: useCallback(eventHandler) memoization guard
