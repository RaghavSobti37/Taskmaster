import { splitPhoneNumber } from './leadFormValidation';
import { stableJsonEqual } from '../hooks/useUnsavedChanges';

export function buildLeadEditState(lead) {
  if (!lead) return null;
  const { countryCode, nationalNumber } = splitPhoneNumber(lead.phone || '');
  return {
    name: lead.name || '',
    phoneCountryCode: countryCode,
    phoneNational: nationalNumber,
    city: lead.city || '',
    leadQuality: lead.leadQuality ? String(lead.leadQuality) : '3',
    leadStatus: lead.leadStatus || 'New',
    callStatus: lead.callStatus || 'Pending',
    remarks: lead.remarks || '',
    nextFollowupDate: lead.nextFollowupDate || '',
    nextFollowupTime: lead.nextFollowupTime || '',
    setReminder: lead.setReminder || false,
    planOption: lead.planOption || '',
    assignedRepId: lead.assignedRepId || lead.assignedRep?._id || '',
  };
}

export function leadEditHasChanges(editData, baseline) {
  return !!baseline && !stableJsonEqual(editData, baseline);
}
