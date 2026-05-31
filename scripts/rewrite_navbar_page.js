const fs = require('fs');

let code = `import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { GripVertical, Eye, EyeOff, Save, RotateCcw, Plus, Trash2, Edit2, Check, X, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui';
import { useNavigate } from 'react-router-dom';

const NavbarCustomizationPage = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [saving, setSaving] = useState(false);
  const [originalGroups, setOriginalGroups] = useState([]);

  // For inline editing custom group titles
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await axios.get('/api/customization/navbar');
      let sortedGroups = (response.data.groups || []).sort((a, b) => a.order - b.order);
      // Ensure pages are sorted
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
      await axios.post('/api/customization/navbar', {
        groups
      });

      setOriginalGroups(JSON.parse(JSON.stringify(groups)));
      // Need to reload window to re-fetch React Query layout if needed, or rely on invalidation?
      // Since we don't have queryClient here easily, window reload is safe.
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

  const togglePageVisibility = (groupId, path) => {
    setGroups(groups.map(g => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        pages: g.pages.map(p => p.path === path ? { ...p, visible: !p.visible } : p)
      };
    }));
  };

  const toggleGroupVisibility = (groupId) => {
    setGroups(groups.map(g => g.id === groupId ? { ...g, visible: !g.visible } : g));
  };

  const handleCreateGroup = () => {
    const newGroupId = 'custom-' + Date.now();
    setGroups([...groups, {
      id: newGroupId,
      title: 'New Custom Group',
      order: groups.length + 1,
      visible: true,
      isCustom: true,
      pages: []
    }]);
    setEditingGroupId(newGroupId);
    setEditTitle('New Custom Group');
  };

  const handleDeleteGroup = (groupId) => {
    const groupToDelete = groups.find(g => g.id === groupId);
    if (!groupToDelete || groupToDelete.pages.length > 0) {
      alert("Please move all pages out of this group before deleting.");
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

    setGroups(newGroups.map(g => {
      if (g.id === toGroupId) {
        return { ...g, pages: [...g.pages, pageToMove] };
      }
      return g;
    }));
  };

  const handleReorderGroups = (newOrder) => {
    setGroups(newOrder);
  };

  const handleReorderPages = (groupId, newPagesOrder) => {
    setGroups(groups.map(g => g.id === groupId ? { ...g, pages: newPagesOrder } : g));
  };

  const hasChanges = JSON.stringify(groups) !== JSON.stringify(originalGroups);

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-workspace)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-primary)]">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-[var(--color-bg-secondary)] rounded-full transition-colors text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Customize Navigation</h1>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">Reorder groups, hide items, and create custom menus.</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button variant="ghost" onClick={handleReset} disabled={saving} className="gap-2">
            <RotateCcw size={16} /> Reset
          </Button>
          <Button onClick={handleSave} disabled={saving || !hasChanges} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar max-w-4xl mx-auto w-full">
        <div className="flex justify-between items-center mb-6">
          <p className="text-sm text-[var(--color-text-secondary)]">Drag groups to reorder. Move pages between groups using the dropdown.</p>
          <Button size="sm" onClick={handleCreateGroup} variant="outline" className="gap-2">
            <Plus size={16} /> Add Custom Group
          </Button>
        </div>

        <Reorder.Group axis="y" values={groups} onReorder={handleReorderGroups} className="space-y-6 pb-20">
          <AnimatePresence>
            {groups.map((group) => (
              <Reorder.Item key={group.id} value={group} className="bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 p-4 bg-[var(--color-bg-secondary)] border-b border-[var(--color-bg-border)]">
                  <div className="cursor-grab active:cursor-grabbing p-1 text-[var(--color-text-muted)] hover:text-blue-500 transition-colors">
                    <GripVertical size={18} />
                  </div>
                  
                  {editingGroupId === group.id ? (
                    <div className="flex flex-1 gap-2 items-center">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] px-3 py-1.5 rounded text-sm flex-1 focus:outline-none focus:border-blue-500 font-bold"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && saveGroupTitle(group.id)}
                      />
                      <button onClick={() => saveGroupTitle(group.id)} className="p-1.5 text-green-500 hover:bg-green-500/10 rounded"><Check size={16}/></button>
                      <button onClick={() => setEditingGroupId(null)} className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded"><X size={16}/></button>
                    </div>
                  ) : (
                    <div className="flex-1 font-bold text-[15px] text-[var(--color-text-primary)] tracking-wide">
                      {group.title}
                      {group.isCustom && (
                        <button onClick={() => { setEditingGroupId(group.id); setEditTitle(group.title); }} className="ml-3 text-blue-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit2 size={14} className="inline" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleGroupVisibility(group.id)} className="p-2 rounded hover:bg-[var(--color-bg-border)] transition-colors" title="Toggle Group Visibility">
                      {group.visible ? <Eye size={18} className="text-blue-500" /> : <EyeOff size={18} className="text-[var(--color-text-muted)]" />}
                    </button>
                    {group.isCustom && group.pages.length === 0 && (
                      <button onClick={() => handleDeleteGroup(group.id)} className="p-2 rounded hover:bg-[var(--color-bg-border)] hover:text-rose-500 text-[var(--color-text-muted)] transition-colors" title="Delete Group">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-3 space-y-1 min-h-[60px]">
                  {group.pages.length === 0 ? (
                    <div className="text-sm text-[var(--color-text-muted)] p-4 text-center border-2 border-dashed border-[var(--color-bg-border)] rounded-lg m-2">
                      Empty Group. Move items here using the dropdown on pages.
                    </div>
                  ) : (
                    <Reorder.Group axis="y" values={group.pages} onReorder={(newPages) => handleReorderPages(group.id, newPages)} className="space-y-2 p-1">
                      {group.pages.map((page) => (
                        <Reorder.Item key={page.path} value={page} className="cursor-grab active:cursor-grabbing flex items-center gap-4 p-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg hover:border-blue-500/40 transition-colors shadow-sm">
                          <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          
                          <div className="flex-1 min-w-0 flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-[13px] text-[var(--color-text-primary)]">{page.label}</div>
                              <div className="text-[11px] text-[var(--color-text-muted)] font-mono mt-0.5">{page.path}</div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                              <select 
                                className="text-xs bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-md px-3 py-1.5 outline-none text-[var(--color-text-secondary)] hover:border-blue-500 transition-colors cursor-pointer"
                                value={group.id}
                                onChange={(e) => movePageToGroup(page.path, group.id, e.target.value)}
                              >
                                {groups.map(g => (
                                  <option key={g.id} value={g.id}>Move to: {g.title}</option>
                                ))}
                              </select>
                              
                              <button
                                onClick={() => togglePageVisibility(group.id, page.path)}
                                className="p-2 hover:bg-[var(--color-bg-secondary)] rounded-md transition-all border border-transparent hover:border-[var(--color-bg-border)]"
                              >
                                {page.visible ? (
                                  <Eye className="w-4 h-4 text-blue-500" />
                                ) : (
                                  <EyeOff className="w-4 h-4 text-gray-500" />
                                )}
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
      </div>
    </div>
  );
};

export default NavbarCustomizationPage;
`;

fs.writeFileSync('client/src/pages/settings/NavbarCustomizationPage.jsx', code);
console.log('Rewrote NavbarCustomizationPage successfully!');
