import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { GripVertical, Eye, EyeOff, Save, RotateCcw, Plus, Trash2, Edit2, Check, X, LayoutTemplate } from 'lucide-react';
import { Button } from '../../../components/ui';
import { useDashboardPreset } from '../../../hooks/useTaskmasterQueries';

export default function CustomizationTab() {
  // Navigation State
  const [groups, setGroups] = useState([]);
  const [saving, setSaving] = useState(false);
  const [originalGroups, setOriginalGroups] = useState([]);

  // Editor State
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  // Dashboard State
  const { data: dashboardPreset, refetch: refetchDashboard } = useDashboardPreset();
  const [dashboardElements, setDashboardElements] = useState([]);

  useEffect(() => {
    if (dashboardPreset?.elements) {
      setDashboardElements([...dashboardPreset.elements].sort((a, b) => a.order - b.order));
    } else {
      setDashboardElements([
        { componentId: 'leaderboard', size: '1', order: 1, visible: true },
        { componentId: 'announcements', size: '1', order: 2, visible: true },
        { componentId: 'pinboard', size: '1', order: 3, visible: true },
        { componentId: 'schedule', size: '1', order: 4, visible: true },
        { componentId: 'review-queue', size: '2', order: 5, visible: true },
        { componentId: 'todos-overdue', size: '2', order: 6, visible: true },
        { componentId: 'todos-today', size: '2', order: 7, visible: true },
        { componentId: 'projects-today', size: '4', order: 8, visible: true },
        { componentId: 'notes', size: '2', order: 9, visible: true },
        { componentId: 'composer', size: '2', order: 10, visible: true }
      ]);
    }
  }, [dashboardPreset]);

  const handleReorderDashboard = (newOrder) => setDashboardElements(newOrder);

  const toggleDashboardElement = (componentId) => {
    setDashboardElements(prev => prev.map(el => el.componentId === componentId ? { ...el, visible: !el.visible } : el));
  };

  const setDashboardElementSize = (componentId, size) => {
    setDashboardElements(prev => prev.map(el => el.componentId === componentId ? { ...el, size } : el));
  };

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await axios.get('/api/customization/navbar');
      let sortedGroups = (response.data.groups || []).sort((a, b) => a.order - b.order);
      sortedGroups = sortedGroups.map(g => ({
        ...g,
        pages: (g.pages || []).sort((a, b) => a.order - b.order)
      }));
      setGroups(sortedGroups);
      setOriginalGroups(JSON.parse(JSON.stringify(sortedGroups)));
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post('/api/customization/navbar', { groups });
      const elementsToSave = dashboardElements.map((el, idx) => ({ ...el, order: idx + 1 }));
      await axios.post('/api/customization/dashboard/preset', { name: 'Custom', elements: elementsToSave });
      setOriginalGroups(JSON.parse(JSON.stringify(groups)));
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
      let sortedGroups = (response.data.groups || []).sort((a, b) => a.order - b.order);
      sortedGroups = sortedGroups.map(g => ({
        ...g,
        pages: (g.pages || []).sort((a, b) => a.order - b.order)
      }));
      setGroups(sortedGroups);
      setOriginalGroups(JSON.parse(JSON.stringify(sortedGroups)));
      window.location.reload();
    } catch (error) {
      console.error('Error resetting preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const togglePageVisibility = (groupId, path) => setGroups(groups.map(g => g.id !== groupId ? g : { ...g, pages: g.pages.map(p => p.path === path ? { ...p, visible: !p.visible } : p) }));
  const toggleGroupVisibility = (groupId) => setGroups(groups.map(g => g.id === groupId ? { ...g, visible: !g.visible } : g));
  
  const handleCreateGroup = () => {
    const newGroupId = 'custom-' + Date.now();
    setGroups([...groups, { id: newGroupId, title: 'New Custom Group', order: groups.length + 1, visible: true, isCustom: true, pages: [] }]);
    setEditingGroupId(newGroupId);
    setEditTitle('New Custom Group');
  };

  const handleDeleteGroup = (groupId) => {
    const groupToDelete = groups.find(g => g.id === groupId);
    if (!groupToDelete || groupToDelete.pages.length > 0) return alert("Please move all pages out of this group before deleting.");
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

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-workspace)] overflow-hidden">
      <div className="flex items-center justify-between p-8 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Customization</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">Drag and drop to rearrange your workspace layout.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={handleReset} disabled={saving} className="gap-2 text-[var(--color-text-secondary)]">
            <RotateCcw size={16} /> Reset
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-24 custom-scrollbar">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
          {/* Navigation Editor */}
          <section>
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                  <LayoutTemplate size={18} className="text-blue-500" /> Sidebar Layout
                </h2>
              </div>
              <Button size="sm" onClick={handleCreateGroup} variant="outline" className="gap-2 shadow-sm rounded-lg">
                <Plus size={16} /> Add Custom Group
              </Button>
            </div>

            <Reorder.Group axis="y" values={groups} onReorder={handleReorderGroups} className="space-y-6">
              <AnimatePresence>
                {groups.map((group) => (
                  <Reorder.Item key={group.id} value={group} className="bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-xl shadow-sm overflow-hidden group/item">
                    <div className="flex items-center gap-4 p-4 bg-[var(--color-bg-secondary)] border-b border-[var(--color-bg-border)]">
                      <div className="cursor-grab active:cursor-grabbing p-1.5 text-[var(--color-text-muted)] hover:text-blue-500 hover:bg-blue-500/10 rounded transition-colors">
                        <GripVertical size={18} />
                      </div>

                      {editingGroupId === group.id ? (
                        <div className="flex flex-1 gap-2 items-center">
                          <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] px-3 py-1.5 rounded-lg text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold" autoFocus onKeyDown={(e) => e.key === 'Enter' && saveGroupTitle(group.id)} />
                          <button onClick={() => saveGroupTitle(group.id)} className="p-1.5 text-green-500 bg-green-500/10 hover:bg-green-500/20 rounded-lg transition-colors"><Check size={16} /></button>
                          <button onClick={() => setEditingGroupId(null)} className="p-1.5 text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors"><X size={16} /></button>
                        </div>
                      ) : (
                        <div className="flex-1 font-bold text-[15px] text-[var(--color-text-primary)] tracking-wide flex items-center gap-3">
                          {group.title}
                          {group.isCustom && (
                            <button onClick={() => { setEditingGroupId(group.id); setEditTitle(group.title); }} className="text-[var(--color-text-muted)] hover:text-blue-500 opacity-0 group-hover/item:opacity-100 transition-opacity p-1 rounded-md hover:bg-[var(--color-bg-border)]"><Edit2 size={14} /></button>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleGroupVisibility(group.id)} className="p-2 rounded-lg hover:bg-[var(--color-bg-workspace)] transition-colors border border-transparent hover:border-[var(--color-bg-border)]" title="Toggle Group Visibility">
                          {group.visible ? <Eye size={18} className="text-blue-500" /> : <EyeOff size={18} className="text-[var(--color-text-muted)]" />}
                        </button>
                        {group.isCustom && group.pages.length === 0 && (
                          <button onClick={() => handleDeleteGroup(group.id)} className="p-2 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 text-[var(--color-text-muted)] transition-colors" title="Delete Group">
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-4 bg-[var(--color-bg-primary)]">
                      {group.pages.length === 0 ? (
                        <div className="text-sm text-[var(--color-text-muted)] py-8 text-center border-2 border-dashed border-[var(--color-bg-border)] rounded-xl m-2 bg-[var(--color-bg-workspace)]/50">
                          Empty Group. Move items here using the dropdown on pages.
                        </div>
                      ) : (
                        <Reorder.Group axis="y" values={group.pages} onReorder={(newPages) => handleReorderPages(group.id, newPages)} className="space-y-2">
                          {group.pages.map((page) => (
                            <Reorder.Item key={page.path} value={page} className="cursor-grab active:cursor-grabbing flex items-center gap-4 p-3.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl hover:border-blue-500/40 transition-colors shadow-sm group/page">
                              <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0 flex items-center justify-between">
                                <div>
                                  <div className="font-semibold text-[14px] text-[var(--color-text-primary)]">{page.label}</div>
                                  <div className="text-[12px] text-[var(--color-text-muted)] font-mono mt-0.5">{page.path}</div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <select
                                    className="text-[13px] font-medium bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-lg px-3 py-2 outline-none text-[var(--color-text-primary)] hover:border-blue-500 transition-colors cursor-pointer shadow-sm appearance-none pr-8 relative"
                                    value={group.id}
                                    onChange={(e) => movePageToGroup(page.path, group.id, e.target.value)}
                                    style={{ backgroundImage: "url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23666666%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')", backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
                                  >
                                    {groups.map(g => <option key={g.id} value={g.id}>Move to: {g.title}</option>)}
                                  </select>
                                  <button onClick={() => togglePageVisibility(group.id, page.path)} className="p-2.5 hover:bg-[var(--color-bg-secondary)] rounded-lg transition-all border border-[var(--color-bg-border)] group-hover/page:border-blue-500/20">
                                    {page.visible ? <Eye className="w-[18px] h-[18px] text-blue-500" /> : <EyeOff className="w-[18px] h-[18px] text-[var(--color-text-muted)]" />}
                                  </button>
                                </div>
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

          {/* Dashboard Editor */}
          <section>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                <LayoutTemplate size={18} className="text-blue-500" /> Dashboard Layout
              </h2>
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
                        {['1', '2', '3', '4'].map(s => (
                          <button
                            key={s}
                            onClick={() => setDashboardElementSize(el.componentId, s)}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${el.size === s ? 'bg-blue-500 text-white shadow-sm' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-border)]'}`}
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
    </div>
  );
}


// Performance Optimization: useCallback(eventHandler) memoization guard
