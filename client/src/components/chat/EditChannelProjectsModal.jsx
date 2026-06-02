import React, { useEffect, useState } from 'react';
import { NexusModal, ModalFooter, Button } from '../ui';
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

  const { revert: revertLinkEdits } = useUnsavedChanges({
    baseline: baselineIds,
    draft: projectIds,
    setDraft: setProjectIds,
    hasChanges: hasLinkEdits,
    onSave: () => onSave({ projectIds }),
    enabled: false,
    isSaving: loading,
  });

  return (
    <NexusModal
      isOpen={open}
      onClose={onClose}
      title="Linked projects"
      size="sm"
      showFooter={false}
      footer={
        <ModalFooter>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={revertLinkEdits}
            disabled={!hasLinkEdits || loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            variant="success"
            onClick={() => onSave({ projectIds })}
            disabled={!hasLinkEdits || loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </ModalFooter>
      }
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
