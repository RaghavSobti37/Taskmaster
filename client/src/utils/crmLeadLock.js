import axios from 'axios';

export const isLockedByOther = (lead, currentUserId) => {
  if (!lead?.lockedBy || !currentUserId) return false;
  return String(lead.lockedBy) !== String(currentUserId);
};

export const formatLockToast = (err) => {
  const name = err.response?.data?.lockedByUser?.name || 'Another user';
  return `${name} is editing this lead`;
};

export const releaseLeadLock = async (leadId) => {
  if (!leadId) return;
  try {
    await axios.post(`/api/crm/leads/${leadId}/unlock`, null, {
      headers: { 'x-skip-toast': 'true' },
    });
  } catch {
    /* best-effort */
  }
};

export const closeLeadEditor = (leadId, setSelectedLead) => {
  releaseLeadLock(leadId);
  setSelectedLead(null);
};
