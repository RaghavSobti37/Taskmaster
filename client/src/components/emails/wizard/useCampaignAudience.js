import { useState, useMemo, useCallback, useEffect } from 'react';
import axios from 'axios';
import { leadToRowData, collectAvailableColumns } from '../../../utils/indexedTemplateVariables';
import { computeAudienceHealthCheck } from '../../../utils/audienceHealthCheck';
import { isValidEmail, normalizeEmail, filterValidRecipientRows } from '../../../utils/emailValidation';
import { useToast } from '../../../contexts/ToastContext';
import { useCampaignExlyAudience, useCampaignDataHubAudience } from '../../../hooks/queries/mail';

const UNSENDABLE_EMAIL_STATUSES = new Set(['Invalid', 'Unsubscribed', 'Bounced']);

export const CAMPAIGN_ENGAGEMENT_FILTER_OPTIONS = [
  { value: 'all', label: 'All engagement' },
  { value: 'active', label: 'Active (opened/clicked)' },
  { value: 'inactive', label: 'Inactive (sent, no engagement)' },
  { value: 'none', label: 'No campaign history' },
];

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

function dataHubContactToPreviewRow(contact) {
  if (contact?.leadId && contact?.lead) {
    return {
      name: contact.name,
      email: contact.email,
      leadId: contact.leadId,
      rowData: leadToRowData(contact.lead),
    };
  }
  return {
    name: contact.name,
    email: contact.email,
    rowData: contact.rowData && Object.keys(contact.rowData).length > 0
      ? contact.rowData
      : {
        name: contact.name || '',
        email: contact.email || '',
        source: (contact.inletLabels || []).join(', ') || 'Data Hub',
        inlets: (contact.inletLabels || []).join(', '),
      },
  };
}

function matchesExlyOfferingFilter(contact, offeringIds) {
  if (!Array.isArray(offeringIds) || offeringIds.length === 0) return true;
  const contactIds = (contact.exlyOfferings || [])
    .map((o) => o.offeringId)
    .filter(Boolean);
  if (contact.exlyOfferingId) contactIds.push(contact.exlyOfferingId);
  return offeringIds.some((id) => contactIds.includes(id));
}

function matchesCampaignEngagementFilter(email, engagementByEmail, filter, contactEngagement) {
  if (!filter || filter === 'all') return true;
  const engagement = contactEngagement || engagementByEmail[normalizeEmail(email)] || 'none';
  if (filter === 'none') return engagement === 'none';
  return engagement === filter;
}

export function useCampaignAudience({ templateIndices = [], variableMapping = {} }) {
  const toast = useToast();

  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [selectedExlyIds, setSelectedExlyIds] = useState([]);
  const [selectedDataHubIds, setSelectedDataHubIds] = useState([]);
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
  const [dataHubIncludeInlets, setDataHubIncludeInlets] = useState([]);
  const [dataHubExcludeInlets, setDataHubExcludeInlets] = useState([]);
  const [dataHubLoadRequested, setDataHubLoadRequested] = useState(false);
  const [campaignEngagementFilter, setCampaignEngagementFilter] = useState('all');
  const [engagementByEmail, setEngagementByEmail] = useState({});
  const [engagementLoading, setEngagementLoading] = useState(false);

  const exlyOfferingQueryId = exlyOfferingIdsFilter.length === 1
    ? exlyOfferingIdsFilter[0]
    : 'all';

  const exlyAudienceQuery = useCampaignExlyAudience(
    {
      search: searchTerm || undefined,
      offeringId: exlyOfferingQueryId,
      engagement: campaignEngagementFilter || 'all',
      limit: 100000,
    },
    { enabled: exlyLoadRequested },
  );

  const dataHubAudienceQuery = useCampaignDataHubAudience(
    {
      search: searchTerm || undefined,
      includeInlets: dataHubIncludeInlets.length ? dataHubIncludeInlets.join(',') : undefined,
      excludeInlets: dataHubExcludeInlets.length ? dataHubExcludeInlets.join(',') : undefined,
      engagement: campaignEngagementFilter || 'all',
      limit: 100000,
    },
    { enabled: dataHubLoadRequested },
  );

  const allExlyContacts = exlyAudienceQuery.data?.contacts ?? [];
  const exlyContactsLoading = exlyAudienceQuery.isFetching;
  const allDataHubContacts = dataHubAudienceQuery.data?.contacts ?? [];
  const dataHubContactsLoading = dataHubAudienceQuery.isFetching;

  const clientEngagementEmails = useMemo(() => {
    if (audienceSource === 'crm') {
      return allContacts.map((c) => c.email).filter(Boolean);
    }
    if (audienceSource === 'csv' || audienceSource === 'holysheet') {
      return csvRecipients.map((r) => r.email).filter(Boolean);
    }
    if (audienceSource === 'manual') {
      return manualRecipients.map((r) => r.email).filter(Boolean);
    }
    return [];
  }, [audienceSource, allContacts, csvRecipients, manualRecipients]);

  useEffect(() => {
    if (audienceSource === 'exly' || audienceSource === 'datahub') return undefined;
    if (!clientEngagementEmails.length) {
      setEngagementByEmail({});
      return undefined;
    }

    let cancelled = false;
    const fetchEngagement = async () => {
      setEngagementLoading(true);
      try {
        const res = await axios.post('/api/mail/audience/engagement', {
          emails: clientEngagementEmails,
        });
        if (!cancelled) setEngagementByEmail(res.data?.engagement || {});
      } catch {
        if (!cancelled) setEngagementByEmail({});
      } finally {
        if (!cancelled) setEngagementLoading(false);
      }
    };

    fetchEngagement();
    return () => { cancelled = true; };
  }, [audienceSource, clientEngagementEmails.join('|')]);

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

  const loadDataHubContactsData = useCallback(async () => {
    setDataHubLoadRequested(true);
    try {
      const result = await dataHubAudienceQuery.refetch();
      if (result.error) {
        toast.error('Failed to load Data Hub contacts: ' + (result.error.message || 'Unknown error'));
        return;
      }
      const count = result.data?.contacts?.length ?? 0;
      if (count === 0) toast.warn('No Data Hub contacts found for the current filters.');
      else toast.success(`Loaded ${count} Data Hub contact(s).`);
    } catch (e) {
      toast.error('Failed to load Data Hub contacts: ' + e.message);
    }
  }, [dataHubAudienceQuery, toast]);

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
    () => csvRecipients.filter((r) => {
      if (excludedSources.includes(r.source) || excludedEmails.includes(r.email)) return false;
      return matchesCampaignEngagementFilter(r.email, engagementByEmail, campaignEngagementFilter);
    }),
    [csvRecipients, excludedSources, excludedEmails, engagementByEmail, campaignEngagementFilter],
  );

  const filteredContacts = useMemo(() => allContacts.filter((c) => {
    if (!c.email) return false;
    if (searchTerm && !c.name?.toLowerCase().includes(searchTerm.toLowerCase()) && !c.email?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (!matchesLeadStatusFilter(c, leadStatusFilter)) return false;
    if (!matchesCampaignEngagementFilter(c.email, engagementByEmail, campaignEngagementFilter, c.campaignEngagement)) return false;
    return true;
  }), [allContacts, searchTerm, leadStatusFilter, engagementByEmail, campaignEngagementFilter]);

  const filteredExlyContacts = useMemo(() => allExlyContacts.filter((c) => {
    if (!c.email) return false;
    if (searchTerm && !c.name?.toLowerCase().includes(searchTerm.toLowerCase()) && !c.email?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (!matchesExlyOfferingFilter(c, exlyOfferingIdsFilter)) return false;
    if (!matchesLeadStatusFilter(c, exlyLeadStatusFilter)) return false;
    return true;
  }), [allExlyContacts, searchTerm, exlyOfferingIdsFilter, exlyLeadStatusFilter]);

  const filteredDataHubContacts = useMemo(() => allDataHubContacts.filter((c) => {
    if (!c.email) return false;
    if (searchTerm && !c.name?.toLowerCase().includes(searchTerm.toLowerCase()) && !c.email?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  }), [allDataHubContacts, searchTerm]);

  const displayContacts = useMemo(() => {
    if (audienceSource === 'exly') return filteredExlyContacts;
    if (audienceSource === 'datahub') return filteredDataHubContacts;
    return filteredContacts;
  }, [audienceSource, filteredExlyContacts, filteredDataHubContacts, filteredContacts]);

  const displayManualRecipients = useMemo(
    () => manualRecipients.filter((r) => matchesCampaignEngagementFilter(
      r.email,
      engagementByEmail,
      campaignEngagementFilter,
    )),
    [manualRecipients, engagementByEmail, campaignEngagementFilter],
  );

  const previewRecipients = useMemo(() => {
    const selectedCrm = allContacts.filter((c) => selectedLeadIds.includes(c._id));
    const selectedExly = allExlyContacts.filter((c) => selectedExlyIds.includes(c._id));
    const selectedDataHub = allDataHubContacts.filter((c) => selectedDataHubIds.includes(c._id));
    const manualRows = displayManualRecipients;
    return [
      ...activeCsvRecipients,
      ...manualRows,
      ...selectedCrm.map((c) => ({ name: c.name, email: c.email, leadId: c._id, rowData: leadToRowData(c) })),
      ...selectedExly.map((c) => ({
        name: c.name,
        email: c.email,
        rowData: exlyContactToRowData(c),
      })),
      ...selectedDataHub.map(dataHubContactToPreviewRow),
    ];
  }, [activeCsvRecipients, displayManualRecipients, selectedLeadIds, selectedExlyIds, selectedDataHubIds, allContacts, allExlyContacts, allDataHubContacts]);

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
    setSelectedDataHubIds([]);
    setCsvRecipients([]);
    setCsvFileName('');
    setExcludedSources([]);
    setExcludedEmails([]);
    setManualRecipients([]);
    setAllContacts([]);
    setExlyLoadRequested(false);
    setDataHubLoadRequested(false);
    setDataHubIncludeInlets([]);
    setDataHubExcludeInlets([]);
    setExlyOfferingFilter('all');
    setExlyOfferingIdsFilter([]);
    setExlyLeadStatusFilter('all');
    setCampaignEngagementFilter('all');
    setEngagementByEmail({});
  }, []);

  return {
    selectedLeadIds, setSelectedLeadIds,
    selectedExlyIds, setSelectedExlyIds,
    selectedDataHubIds, setSelectedDataHubIds,
    csvRecipients, setCsvRecipients, csvFileName,
    excludedSources, setExcludedSources,
    excludedEmails, setExcludedEmails,
    loadingHolySheet, loadCrmContactsData, loadExlyContactsData, loadDataHubContactsData,
    contactsLoading, exlyContactsLoading, dataHubContactsLoading,
    handleCsvUpload, fetchHolySheetData,
    searchTerm, setSearchTerm,
    audienceSource, setAudienceSource,
    manualRecipients, setManualRecipients, displayManualRecipients,
    allContacts, allExlyContacts, allDataHubContacts,
    filteredContacts, filteredExlyContacts, filteredDataHubContacts, displayContacts,
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
    dataHubIncludeInlets, setDataHubIncludeInlets,
    dataHubExcludeInlets, setDataHubExcludeInlets,
    campaignEngagementFilter, setCampaignEngagementFilter,
    engagementByEmail, engagementLoading,
    activeCsvRecipients,
  };
}
