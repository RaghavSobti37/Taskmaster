import { useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { leadToRowData, collectAvailableColumns } from '../../../utils/indexedTemplateVariables';
import { computeAudienceHealthCheck } from '../../../utils/audienceHealthCheck';
import { isValidEmail, normalizeEmail, filterValidRecipientRows } from '../../../utils/emailValidation';
import { useToast } from '../../../contexts/ToastContext';
import { useCampaignExlyAudience } from '../../../hooks/queries/mail';

const UNSENDABLE_EMAIL_STATUSES = new Set(['Invalid', 'Unsubscribed', 'Bounced']);

function isSendableCrmLead(lead) {
  if (!lead?.email) return false;
  if (UNSENDABLE_EMAIL_STATUSES.has(lead.emailStatus)) return false;
  if (lead.status === 'inactive' || lead.unsubscribed) return false;
  return isValidEmail(normalizeEmail(lead.email));
}

function isExlyLead(lead) {
  if (!lead?.email) return false;
  if (Array.isArray(lead.exlyOfferings) && lead.exlyOfferings.length > 0) return true;
  return Boolean(lead.exlyOfferingTitle || lead.exlyOfferingId);
}

function exlyContactToRowData(contact) {
  if (contact?.rowData && Object.keys(contact.rowData).length > 0) return contact.rowData;
  const offerings = (contact?.exlyOfferings || [])
    .map((o) => o.title)
    .filter(Boolean);
  const offeringLabel = offerings.length
    ? offerings.join(', ')
    : (contact?.exlyOfferingTitle || '');
  return {
    name: contact?.name || '',
    email: contact?.email || '',
    source: 'Exly',
    exlyOfferingTitle: offeringLabel,
    offering: offeringLabel,
  };
}

function matchesLeadStatusFilter(lead, filter) {
  if (!filter || filter === 'all') return true;
  const status = lead.leadStatus || 'Fresh';
  if (filter === 'Fresh') {
    return !status || status === 'Fresh' || status === 'New';
  }
  return status === filter;
}

function matchesExlyOfferingFilter(contact, offeringIds) {
  if (!Array.isArray(offeringIds) || offeringIds.length === 0) return true;
  const contactIds = (contact.exlyOfferings || [])
    .map((o) => o.offeringId)
    .filter(Boolean);
  if (contact.exlyOfferingId) contactIds.push(contact.exlyOfferingId);
  return offeringIds.some((id) => contactIds.includes(id));
}

export function useCampaignAudience({ templateIndices = [], variableMapping = {} }) {
  const toast = useToast();

  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [selectedExlyIds, setSelectedExlyIds] = useState([]);
  const [csvRecipients, setCsvRecipients] = useState([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [excludedSources, setExcludedSources] = useState([]);
  const [excludedEmails, setExcludedEmails] = useState([]);
  const [loadingHolySheet, setLoadingHolySheet] = useState(false);
  const [allContacts, setAllContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [audienceSource, setAudienceSource] = useState('csv');
  const [manualRecipients, setManualRecipients] = useState([]);
  const [crmSegment, setCrmSegment] = useState('sales');
  const [artistProjectFilter, setArtistProjectFilter] = useState('all');
  const [contactCategoryFilter, setContactCategoryFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [leadStatusFilter, setLeadStatusFilter] = useState('all');
  const [exlyOfferingIdsFilter, setExlyOfferingIdsFilter] = useState([]);
  const [exlyLeadStatusFilter, setExlyLeadStatusFilter] = useState('all');
  const [exlyOfferingFilter, setExlyOfferingFilter] = useState('all');
  const [exlyLoadRequested, setExlyLoadRequested] = useState(false);

  const exlyOfferingQueryId = exlyOfferingIdsFilter.length === 1
    ? exlyOfferingIdsFilter[0]
    : 'all';

  const exlyAudienceQuery = useCampaignExlyAudience(
    {
      search: searchTerm || undefined,
      offeringId: exlyOfferingQueryId,
      limit: 100000,
    },
    { enabled: exlyLoadRequested },
  );

  const allExlyContacts = exlyAudienceQuery.data?.contacts ?? [];
  const exlyContactsLoading = exlyAudienceQuery.isFetching;

  const loadCrmContactsData = useCallback(async (segment = crmSegment) => {
    setContactsLoading(true);
    try {
      const params = { limit: 100000, hasEmail: true, crmType: segment };
      if (segment === 'artist') {
        params.excludeContactCategory = 'booking_enquiry';
        if (artistProjectFilter !== 'all') params.artistProject = artistProjectFilter;
        if (contactCategoryFilter !== 'all') params.contactCategory = contactCategoryFilter;
        if (tagFilter !== 'all') params.tag = tagFilter;
      }
      if (leadStatusFilter && leadStatusFilter !== 'all') {
        params.leadStatus = leadStatusFilter;
      }
      const res = await axios.get('/api/crm/leads', { params });
      const leads = (res.data?.leads || res.data || []).filter(isSendableCrmLead);
      setAllContacts(leads.filter((l) => !isExlyLead(l)));
    } catch (e) {
      toast.error('Failed to load CRM contacts: ' + e.message);
    }
    setContactsLoading(false);
  }, [toast, crmSegment, artistProjectFilter, contactCategoryFilter, tagFilter, leadStatusFilter]);

  const loadExlyContactsData = useCallback(async () => {
    setExlyLoadRequested(true);
    try {
      const result = await exlyAudienceQuery.refetch();
      if (result.error) {
        toast.error('Failed to load Exly contacts: ' + (result.error.message || 'Unknown error'));
        return;
      }
      const count = result.data?.contacts?.length ?? 0;
      if (count === 0) toast.warn('No Exly contacts found for the current filters.');
      else toast.success(`Loaded ${count} Exly contact(s).`);
    } catch (e) {
      toast.error('Failed to load Exly contacts: ' + e.message);
    }
  }, [exlyAudienceQuery, toast]);

  const handleCsvUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split(/\r?\n/).filter((line) => line.trim());
      if (lines.length < 2) return;
      const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const emailIdx = header.findIndex((h) => h.includes('email'));
      const nameIdx = header.findIndex((h) => h === 'name' || h.includes('first name'));
      if (emailIdx === -1) {
        toast.warn('Could not detect "email" column in CSV header.');
        return;
      }
      const parsed = [];
      let skipped = 0;
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map((p) => p.trim());
        const email = parts[emailIdx];
        const name = nameIdx !== -1 ? parts[nameIdx] : '';
        const rowData = {};
        header.forEach((h, idx) => { if (h) rowData[h] = parts[idx] != null ? parts[idx] : ''; });
        if (!email) continue;
        email.split(/[,;]/).map((se) => se.trim()).filter(Boolean).forEach((se) => {
          const normalized = normalizeEmail(se);
          if (isValidEmail(normalized)) parsed.push({ name, email: normalized, source: 'CSV Upload', rowData });
          else if (normalized) skipped += 1;
        });
      }
      setCsvRecipients((prev) => {
        const filtered = prev.filter((p) => p.source !== 'CSV Upload');
        return [...filtered, ...parsed];
      });
      if (skipped > 0) toast.success(`CSV loaded ${parsed.length} valid. Skipped ${skipped} invalid.`);
      else toast.success(`CSV loaded ${parsed.length} recipient(s).`);
    };
    reader.readAsText(file);
  }, [toast]);

  const fetchHolySheetData = useCallback(async () => {
    setLoadingHolySheet(true);
    try {
      const res = await axios.get('/api/mail/holysheet/all');
      const rawRecs = res.data || [];
      const newRecs = [];
      let skipped = 0;
      rawRecs.forEach((rec) => {
        if (rec?.email) {
          rec.email.split(/[,;]/).map((e) => e.trim()).filter(Boolean).forEach((se) => {
            const normalized = normalizeEmail(se);
            if (isValidEmail(normalized)) newRecs.push({ ...rec, email: normalized });
            else if (normalized) skipped += 1;
          });
        }
      });
      setCsvRecipients((prev) => {
        const filtered = prev.filter((p) => !p.source || p.source === 'CSV Upload');
        return [...filtered, ...newRecs];
      });
      const holySheetSources = Array.from(new Set(newRecs.map((r) => r.source).filter(Boolean)));
      setExcludedSources((prev) => [...new Set([...prev, ...holySheetSources])]);
      const skipNote = skipped > 0 ? ` Skipped ${skipped} invalid.` : '';
      toast.success(`Loaded ${newRecs.length} from HolySheet (${holySheetSources.length} tabs deselected by default).${skipNote}`);
    } catch (e) {
      toast.error('Failed to load HolySheet: ' + (e.response?.data?.error || e.message));
    }
    setLoadingHolySheet(false);
  }, [toast]);

  const activeCsvRecipients = useMemo(
    () => csvRecipients.filter((r) => !excludedSources.includes(r.source) && !excludedEmails.includes(r.email)),
    [csvRecipients, excludedSources, excludedEmails],
  );

  const filteredContacts = useMemo(() => allContacts.filter((c) => {
    if (!c.email) return false;
    if (searchTerm && !c.name?.toLowerCase().includes(searchTerm.toLowerCase()) && !c.email?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (!matchesLeadStatusFilter(c, leadStatusFilter)) return false;
    return true;
  }), [allContacts, searchTerm, leadStatusFilter]);

  const filteredExlyContacts = useMemo(() => allExlyContacts.filter((c) => {
    if (!c.email) return false;
    if (searchTerm && !c.name?.toLowerCase().includes(searchTerm.toLowerCase()) && !c.email?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (!matchesExlyOfferingFilter(c, exlyOfferingIdsFilter)) return false;
    if (!matchesLeadStatusFilter(c, exlyLeadStatusFilter)) return false;
    return true;
  }), [allExlyContacts, searchTerm, exlyOfferingIdsFilter, exlyLeadStatusFilter]);

  const displayContacts = useMemo(() => (
    audienceSource === 'exly' ? filteredExlyContacts : filteredContacts
  ), [audienceSource, filteredExlyContacts, filteredContacts]);

  const previewRecipients = useMemo(() => {
    const selectedCrm = allContacts.filter((c) => selectedLeadIds.includes(c._id));
    const selectedExly = allExlyContacts.filter((c) => selectedExlyIds.includes(c._id));
    return [
      ...activeCsvRecipients,
      ...manualRecipients,
      ...selectedCrm.map((c) => ({ name: c.name, email: c.email, leadId: c._id, rowData: leadToRowData(c) })),
      ...selectedExly.map((c) => ({
        name: c.name,
        email: c.email,
        rowData: exlyContactToRowData(c),
      })),
    ];
  }, [activeCsvRecipients, manualRecipients, selectedLeadIds, selectedExlyIds, allContacts, allExlyContacts]);

  const selectedCrmLeadIds = useMemo(
    () => previewRecipients.filter((r) => r.leadId).map((r) => r.leadId),
    [previewRecipients],
  );

  const availableColumns = useMemo(() => collectAvailableColumns(previewRecipients), [previewRecipients]);

  const audienceHealth = useMemo(
    () => computeAudienceHealthCheck(previewRecipients, templateIndices, variableMapping, availableColumns),
    [previewRecipients, templateIndices, variableMapping, availableColumns],
  );

  const buildMergedRecipients = useCallback(() => {
    const nonCrm = previewRecipients.filter((r) => !r.leadId);
    const { valid } = filterValidRecipientRows(nonCrm);
    return valid;
  }, [previewRecipients]);

  const buildLeadIds = useCallback(() => selectedCrmLeadIds, [selectedCrmLeadIds]);

  const resetAudience = useCallback(() => {
    setSelectedLeadIds([]);
    setSelectedExlyIds([]);
    setCsvRecipients([]);
    setCsvFileName('');
    setExcludedSources([]);
    setExcludedEmails([]);
    setManualRecipients([]);
    setAllContacts([]);
    setExlyLoadRequested(false);
    setExlyOfferingFilter('all');
    setExlyOfferingIdsFilter([]);
    setExlyLeadStatusFilter('all');
  }, []);

  return {
    selectedLeadIds, setSelectedLeadIds,
    selectedExlyIds, setSelectedExlyIds,
    csvRecipients, setCsvRecipients, csvFileName,
    excludedSources, setExcludedSources,
    excludedEmails, setExcludedEmails,
    loadingHolySheet, loadCrmContactsData, loadExlyContactsData,
    contactsLoading, exlyContactsLoading,
    handleCsvUpload, fetchHolySheetData,
    searchTerm, setSearchTerm,
    audienceSource, setAudienceSource,
    manualRecipients, setManualRecipients,
    allContacts, allExlyContacts,
    filteredContacts, filteredExlyContacts, displayContacts,
    previewRecipients, availableColumns, audienceHealth,
    buildMergedRecipients, buildLeadIds, resetAudience,
    crmSegment, setCrmSegment,
    artistProjectFilter, setArtistProjectFilter,
    contactCategoryFilter, setContactCategoryFilter,
    tagFilter, setTagFilter,
    leadStatusFilter, setLeadStatusFilter,
    exlyOfferingIdsFilter, setExlyOfferingIdsFilter,
    exlyLeadStatusFilter, setExlyLeadStatusFilter,
    exlyOfferingFilter, setExlyOfferingFilter,
    activeCsvRecipients,
  };
}
