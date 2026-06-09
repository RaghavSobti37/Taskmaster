import { useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { leadToRowData, collectAvailableColumns } from '../../../utils/indexedTemplateVariables';
import { computeAudienceHealthCheck } from '../../../utils/audienceHealthCheck';
import { isValidEmail, normalizeEmail, filterValidRecipientRows } from '../../../utils/emailValidation';
import { useToast } from '../../../contexts/ToastContext';
export function useCampaignAudience({ templateIndices = [], variableMapping = {} }) {
  const toast = useToast();

  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [csvRecipients, setCsvRecipients] = useState([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [excludedSources, setExcludedSources] = useState([]);
  const [excludedEmails, setExcludedEmails] = useState([]);
  const [loadingHolySheet, setLoadingHolySheet] = useState(false);
  const [allContacts, setAllContacts] = useState([]);
  const [allExlyContacts, setAllExlyContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [exlyContactsLoading, setExlyContactsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [audienceSource, setAudienceSource] = useState('crm');
  const [manualRecipients, setManualRecipients] = useState([]);

  const loadCrmContactsData = useCallback(async () => {
    setContactsLoading(true);
    try {
      const res = await axios.get('/api/crm/leads?limit=100000');
      const leads = res.data?.leads || res.data || [];
      setAllContacts(leads.filter((l) => l.email && !l.exlyOfferings));
    } catch (e) {
      toast.error('Failed to load CRM contacts: ' + e.message);
    }
    setContactsLoading(false);
  }, [toast]);

  const loadExlyContactsData = useCallback(async () => {
    setExlyContactsLoading(true);
    try {
      const res = await axios.get('/api/crm/leads?limit=100000');
      const leads = res.data?.leads || res.data || [];
      setAllExlyContacts(leads.filter((l) => l.email && l.exlyOfferings && Array.isArray(l.exlyOfferings)));
    } catch (e) {
      toast.error('Failed to load Exly contacts: ' + e.message);
    }
    setExlyContactsLoading(false);
  }, [toast]);

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
    [csvRecipients, excludedSources, excludedEmails]
  );

  const filteredContacts = useMemo(() => allContacts.filter((c) => {
    if (!c.email) return false;
    if (searchTerm && !c.name?.toLowerCase().includes(searchTerm.toLowerCase()) && !c.email?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (activeTab === 'fresh' && c.leadStatus !== 'Fresh') return false;
    if (activeTab === 'contacted' && c.leadStatus !== 'Contacted') return false;
    return true;
  }), [allContacts, searchTerm, activeTab]);

  const filteredExlyContacts = useMemo(() => allExlyContacts.filter((c) => {
    if (!c.email) return false;
    if (searchTerm && !c.name?.toLowerCase().includes(searchTerm.toLowerCase()) && !c.email?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  }), [allExlyContacts, searchTerm]);

  const previewRecipients = useMemo(() => {
    const selectedCrm = allContacts.filter((c) => selectedLeadIds.includes(c._id));
    const selectedExly = allExlyContacts.filter((c) => selectedLeadIds.includes(c._id));
    return [
      ...activeCsvRecipients,
      ...manualRecipients,
      ...selectedCrm.map((c) => ({ name: c.name, email: c.email, rowData: leadToRowData(c) })),
      ...selectedExly.map((c) => ({ name: c.name, email: c.email, rowData: leadToRowData(c) })),
    ];
  }, [activeCsvRecipients, manualRecipients, selectedLeadIds, allContacts, allExlyContacts]);

  const availableColumns = useMemo(() => collectAvailableColumns(previewRecipients), [previewRecipients]);

  const audienceHealth = useMemo(
    () => computeAudienceHealthCheck(previewRecipients, templateIndices, variableMapping, availableColumns),
    [previewRecipients, templateIndices, variableMapping, availableColumns]
  );

  const buildMergedRecipients = useCallback(() => {
    const { valid } = filterValidRecipientRows(previewRecipients);
    return valid;
  }, [previewRecipients]);

  const resetAudience = useCallback(() => {
    setSelectedLeadIds([]);
    setCsvRecipients([]);
    setCsvFileName('');
    setExcludedSources([]);
    setExcludedEmails([]);
    setManualRecipients([]);
    setAllContacts([]);
    setAllExlyContacts([]);
  }, []);

  return {
    selectedLeadIds, setSelectedLeadIds,
    csvRecipients, setCsvRecipients, csvFileName,
    excludedSources, setExcludedSources,
    excludedEmails, setExcludedEmails,
    loadingHolySheet, loadCrmContactsData, loadExlyContactsData,
    contactsLoading, exlyContactsLoading,
    handleCsvUpload, fetchHolySheetData,
    searchTerm, setSearchTerm, activeTab, setActiveTab,
    audienceSource, setAudienceSource,
    manualRecipients, setManualRecipients,
    allContacts, allExlyContacts,
    filteredContacts, filteredExlyContacts,
    previewRecipients, availableColumns, audienceHealth,
    buildMergedRecipients, resetAudience,
    activeCsvRecipients,
  };
}
