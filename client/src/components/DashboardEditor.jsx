import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { GripVertical, Eye, EyeOff } from 'lucide-react';
import { NexusModal, Button, ModalFooter } from './ui';
import { useUnsavedChanges, stableJsonEqual, cloneSnapshot } from '../hooks/useUnsavedChanges';

const DashboardEditor = ({ isOpen, onClose, onSave }) => {
  const [preset, setPreset] = useState(null);
  const [elements, setElements] = useState([]);
  const [saving, setSaving] = useState(false);
  const [departmentPresets, setDepartmentPresets] = useState([]);
  const [selectedDept, setSelectedDept] = useState('custom');
  const [baselineElements, setBaselineElements] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    fetchPreset();
    fetchDepartmentPresets();
  }, [isOpen]);

  const fetchPreset = async () => {
    try {
      const response = await axios.get('/api/customization/dashboard/preset');
      const loaded = response.data.elements || [];
      setPreset(response.data);
      setElements(loaded);
      setBaselineElements(cloneSnapshot(loaded));
    } catch (error) {
      console.error('Error fetching preset:', error);
    }
  };

  const fetchDepartmentPresets = async () => {
    try {
      const response = await axios.get('/api/customization/dashboard/presets/department');
      setDepartmentPresets(response.data);
    } catch (error) {
      console.error('Error fetching department presets:', error);
    }
  };

  const loadDepartmentPreset = async (dept) => {
    try {
      const response = await axios.post(`/api/customization/dashboard/preset/department/${dept}`);
      const loaded = response.data.elements || [];
      setPreset(response.data);
      setElements(loaded);
      setBaselineElements(cloneSnapshot(loaded));
      setSelectedDept(dept);
    } catch (error) {
      console.error('Error loading department preset:', error);
    }
  };

  const toggleVisibility = (componentId) => {
    setElements(elements.map(el =>
      el.componentId === componentId ? { ...el, visible: !el.visible } : el
    ));
  };

  const changeSize = (componentId, newSize) => {
    setElements(elements.map(el =>
      el.componentId === componentId ? { ...el, size: newSize } : el
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post('/api/customization/dashboard/preset', {
        name: preset.name,
        elements: elements.map((el, idx) => ({
          ...el,
          order: idx + 1
        })),
        department: selectedDept
      });

      if (onSave) onSave();

      // Refresh page to apply changes
      setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      console.error('Error saving preset:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setElements(cloneSnapshot(baselineElements));
  };

  const hasLayoutChanges = isOpen && !stableJsonEqual(elements, baselineElements);

  const { revert: revertLayoutEdits } = useUnsavedChanges({
    hasChanges: hasLayoutChanges,
    onSave: handleSave,
    onCancel: handleReset,
    isSaving: saving,
    enabled: false,
  });

  return (
    <NexusModal
      isOpen={isOpen}
      onClose={onClose}
      showFooter={false}
      title="Customize Dashboard"
      className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
      footer={
        <ModalFooter>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={revertLayoutEdits}
            disabled={!hasLayoutChanges || saving}
          >
            Discard
          </Button>
          <Button
            type="button"
            size="sm"
            variant="success"
            onClick={handleSave}
            disabled={!hasLayoutChanges || saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </ModalFooter>
      }
    >
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {/* Department Presets */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Quick Presets</h3>
          <div className="grid grid-cols-2 gap-2">
            {departmentPresets.map(dept => (
              <button
                key={dept.id}
                onClick={() => loadDepartmentPreset(dept.id)}
                className={`p-2 rounded border text-xs font-bold transition-all ${
                  selectedDept === dept.id
                    ? 'bg-blue-600 border-blue-500'
                    : 'bg-[var(--color-bg-primary)] border-[var(--color-bg-border)] hover:border-blue-500'
                }`}
              >
                {dept.name}
              </button>
            ))}
          </div>
        </div>

        {/* Dashboard Elements */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Elements</h3>
          <Reorder.Group
            axis="y"
            values={elements}
            onReorder={setElements}
            className="space-y-2"
          >
            <AnimatePresence>
              {elements.map((element, idx) => (
                <Reorder.Item
                  key={element.componentId}
                  value={element}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <motion.div
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-3 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-lg flex items-center gap-3"
                  >
                    <GripVertical className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm capitalize">{element.componentId.replace('-', ' ')}</div>
                      <div className="text-xs text-gray-500">Order: {idx + 1}</div>
                    </div>

                    {/* Size Toggle */}
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => changeSize(element.componentId, '1')}
                        className={`px-2 py-1 text-xs font-bold rounded transition-all ${
                          element.size === '1'
                            ? 'bg-blue-600'
                            : 'bg-[var(--color-bg-secondary)] hover:bg-blue-600/20'
                        }`}
                      >
                        1col
                      </button>
                      <button
                        onClick={() => changeSize(element.componentId, '3')}
                        className={`px-2 py-1 text-xs font-bold rounded transition-all ${
                          element.size === '3'
                            ? 'bg-blue-600'
                            : 'bg-[var(--color-bg-secondary)] hover:bg-blue-600/20'
                        }`}
                      >
                        3col
                      </button>
                    </div>

                    {/* Visibility Toggle */}
                    <button
                      onClick={() => toggleVisibility(element.componentId)}
                      className="p-2 hover:bg-[var(--color-bg-secondary)] rounded transition-all"
                    >
                      {element.visible ? (
                        <Eye className="w-4 h-4 text-blue-400" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  </motion.div>
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>
        </div>
      </div>

    </NexusModal>
  );
};

export default DashboardEditor;
