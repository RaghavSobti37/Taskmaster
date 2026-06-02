import React, { useEffect, useState } from 'react';
import { NexusModal } from '../ui';
import ChannelProjectLinksPicker from './ChannelProjectLinksPicker';
import { useUnsavedChanges, stableJsonEqual, cloneSnapshot } from '../../hooks/useUnsavedChanges';

const EditChannelProjectsModal = ({
  open,
  onClose,
  channel,
  onSave,
  loading,
}) => {
  const [projectIds, setProjectIds] = useState([]);
  const [baselineIds, setBaselineIds] = useState([]);

  useEffect(() => {
    if (!open || !channel) return;
    const ids = (channel.linkedProjects || []).map((p) => String(p._id));
    const initial = !ids.length && channel.projectId
      ? [String(channel.projectId)]
      : ids;
    setProjectIds(initial);
    setBaselineIds(cloneSnapshot(initial));
  }, [open, channel]);

  const hasLinkEdits = open && !stableJsonEqual(projectIds, baselineIds);

  useUnsavedChanges({
    hasChanges: hasLinkEdits,
    onSave: () => onSave({ projectIds }),
    onCancel: () => setProjectIds(cloneSnapshot(baselineIds)),
    isSaving: loading,
    elevated: true,
  });

  return (
    <NexusModal
      isOpen={open}
      onClose={onClose}
      title="Linked projects"
      size="sm"
      showFooter={false}
    >
      <p className="text-[11px] text-[var(--color-text-muted)] mb-3">
        Workspace: <strong>{channel?.projectWorkspace || 'GENERAL'}</strong>
      </p>
      <ChannelProjectLinksPicker
        workspace={channel?.projectWorkspace}
        selectedIds={projectIds}
        onChange={setProjectIds}
        disabled={loading}
      />
    </NexusModal>
  );
};

export default EditChannelProjectsModal;
