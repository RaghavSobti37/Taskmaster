import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  parseIndexedVariablesFromHtml,
  getEffectiveTemplateContent,
  leadToRowData,
  collectAvailableColumns,
} from '../../utils/indexedTemplateVariables';
import { computeAudienceHealthCheck } from '../../utils/audienceHealthCheck';
import { isValidEmail, normalizeEmail, filterValidRecipientRows } from '../../utils/emailValidation';
import {
  appendSignature,
  syncSignatureInContent,
  stripSignature,
  countSignatureBlocks,
  estimateJsonBytes,
  PAYLOAD_SAFE_BYTES,
} from '../../utils/smtpPresets';
import {
  syncUnsubscribeInContent,
  appendUnsubscribe,
  stripUnsubscribe,
  countUnsubscribeBlocks,
} from '../../utils/emailContentUtils';
import { useCreateCampaign, useUploadCampaignAttachment } from '../../hooks/useTaskmasterQueries';
import { useToast } from '../../contexts/ToastContext';
import { useLoadingPhrase } from '../../hooks/useLoadingPhrase';
import axios from 'axios';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import {
  EMPTY_WIZARD_SNAPSHOT,
  applyWizardEditableState,
  buildWizardEditableState,
  cloneWizardSnapshot,
  wizardHasChanges,
} from '../../utils/mailCampaignWizardSnapshot';
import { useConfirm } from '../../contexts/confirmContext';

export function useMailCampaignWizard({
  profiles = [],
  approvedTemplates = [],
  standaloneWizard = false,
  seed = null,
  onExit,
  onOpenProfiles,
  onOpenTemplates,
}) {
  const toast = useToast();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const fetchLoadingPhrase = useLoadingPhrase();
  const createCampaignMutation = useCreateCampaign();
  const uploadAttachmentMutation = useUploadCampaignAttachment();

  const [campaignStep, setCampaignStep] = useState(1);
  const [previewRecipientIndex, setPreviewRecipientIndex] = useState(0);
  const [serverPreviewDoc, setServerPreviewDoc] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [holySheetTab, setHolySheetTab] = useState('');
  const [loadingHolySheet, setLoadingHolySheet] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [senderProfileId, setSenderProfileId] = useState('');
  const [senderMode, setSenderMode] = useState('single');
  const [senderProfileIds, setSenderProfileIds] = useState([]);
  const [includeSignature, setIncludeSignature] = useState(false);
  const [signatureProfileId, setSignatureProfileId] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [csvRecipients, setCsvRecipients] = useState([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [htmlFileName, setHtmlFileName] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [excludedSources, setExcludedSources] = useState([]);
  const [excludedEmails, setExcludedEmails] = useState([]);
  const [includeUnsubscribe, setIncludeUnsubscribe] = useState(false);
  const [isCustomHtml, setIsCustomHtml] = useState(false);
  const [useRawHtml, setUseRawHtml] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [variableMapping, setVariableMapping] = useState({});
  const [testCampaignEmail, setTestCampaignEmail] = useState('');
  const [activeExternalTab, setActiveExternalTab] = useState('ALL');
  const [externalSearch, setExternalSearch] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [filters, setFilters] = useState({
    leadStatus: 'all',
    exlyOffering: 'all',
  });
  const [allContacts, setAllContacts] = useState([]);
  const [allExlyContacts, setAllExlyContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [exlyContactsLoading, setExlyContactsLoading] = useState(false);
  const [wizardBaseline, setWizardBaseline] = useState(() => cloneWizardSnapshot(EMPTY_WIZARD_SNAPSHOT));

  const wizardSetters = useMemo(
    () => ({
      setCampaignStep,
      setTitle,
      setSubject,
      setContent,
      setSenderProfileId,
      setSenderMode,
      setSenderProfileIds,
      setIncludeSignature,
      setIncludeUnsubscribe,
      setSelectedLeadIds,
      setCsvRecipients,
      setAttachments,
      setExcludedSources,
      setExcludedEmails,
      setIsCustomHtml,
      setUseRawHtml,
      setSelectedTemplateId,
      setVariableMapping,
      setTestCampaignEmail,
    }),
    []
  );

  const currentWizardState = useMemo(
    () => buildWizardEditableState({
      campaignStep,
      title,
      subject,
      content,
      senderProfileId,
      senderMode,
      senderProfileIds,
      includeSignature,
      includeUnsubscribe,
      selectedLeadIds,
      csvRecipients,
      attachments,
      excludedSources,
      excludedEmails,
      isCustomHtml,
      useRawHtml,
      selectedTemplateId,
      variableMapping,
      testCampaignEmail,
    }),
    [
      campaignStep,
      title,
      subject,
      content,
      senderProfileId,
      senderMode,
      senderProfileIds,
      includeSignature,
      includeUnsubscribe,
      selectedLeadIds,
      csvRecipients,
      attachments,
      excludedSources,
      excludedEmails,
      isCustomHtml,
      useRawHtml,
      selectedTemplateId,
      variableMapping,
      testCampaignEmail,
    ]
  );

  const wizardDirty = wizardHasChanges(currentWizardState, wizardBaseline);

  const revertWizardEdits = useCallback(() => {
    applyWizardEditableState(wizardBaseline, wizardSetters);
    setPreviewRecipientIndex(0);
    setCsvFileName('');
    setHtmlFileName('');
  }, [wizardBaseline, wizardSetters]);

  useEffect(() => {
    if (!seed?.token) return;
    if (seed.templateId) setSelectedTemplateId(seed.templateId);
    if (seed.subject) setSubject(seed.subject);
    if (seed.step) setCampaignStep(seed.step);
  }, [seed?.token, seed?.templateId, seed?.subject, seed?.step]);

  const loadCrmContactsData = async () => {
    setContactsLoading(true);
    try {
      const res = await axios.get('/api/crm/leads?limit=100000');
      const leads = res.data?.leads || res.data || [];
      setAllContacts(leads.filter((l) => l.email && !l.exlyOfferings));
    } catch (e) {
      toast.error('Failed to load CRM Contacts: ' + e.message);
    }
    setContactsLoading(false);
  };

  const loadExlyContactsData = async () => {
    setExlyContactsLoading(true);
    try {
      const res = await axios.get('/api/crm/leads?limit=100000');
      const leads = res.data?.leads || res.data || [];
      setAllExlyContacts(leads.filter((l) => l.email && l.exlyOfferings && Array.isArray(l.exlyOfferings)));
    } catch (e) {
      toast.error('Failed to load Exly Contacts: ' + e.message);
    }
    setExlyContactsLoading(false);
  };

  const filteredContacts = useMemo(() => {
    return allContacts.filter((c) => {
      if (!c.email) return false;
      if (searchTerm && !c.name?.toLowerCase().includes(searchTerm.toLowerCase()) && !c.email?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (activeTab === 'fresh' && c.leadStatus !== 'Fresh') return false;
      if (activeTab === 'contacted' && c.leadStatus !== 'Contacted') return false;
      if (filters.leadStatus !== 'all' && c.leadStatus !== filters.leadStatus) return false;
      return true;
    });
  }, [allContacts, searchTerm, activeTab, filters]);

  const filteredExlyContacts = useMemo(() => {
    return allExlyContacts.filter((c) => {
      if (!c.email) return false;
      if (searchTerm && !c.name?.toLowerCase().includes(searchTerm.toLowerCase()) && !c.email?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (activeTab === 'fresh' && c.leadStatus !== 'Fresh') return false;
      if (activeTab === 'contacted' && c.leadStatus !== 'Contacted') return false;
      if (filters.leadStatus !== 'all' && c.leadStatus !== filters.leadStatus) return false;
      if (filters.exlyOffering !== 'all' && Array.isArray(c.exlyOfferings)) {
        const offeringNames = c.exlyOfferings.map((o) => (typeof o === 'string' ? o : o?.title || o?.offeringId)).filter(Boolean);
        if (!offeringNames.includes(filters.exlyOffering)) return false;
      } else if (filters.exlyOffering !== 'all' && c.exlyOfferingTitle !== filters.exlyOffering) {
        return false;
      }
      return true;
    });
  }, [allExlyContacts, searchTerm, activeTab, filters]);

  const exlyOfferingsList = useMemo(() => {
    const list = new Set();
    allExlyContacts.forEach((c) => {
      if (Array.isArray(c.exlyOfferings)) {
        c.exlyOfferings.forEach((o) => {
          const name = typeof o === 'string' ? o : o?.title || o?.offeringId;
          if (name) list.add(name);
        });
      } else if (c.exlyOfferingTitle) {
        list.add(c.exlyOfferingTitle);
      }
    });
    return Array.from(list);
  }, [allExlyContacts]);

  const isRawHtmlPreview = useMemo(() => {
    return useRawHtml
      || isCustomHtml
      || /^\s*<!DOCTYPE/i.test(content)
      || /^\s*<html[\s>]/i.test(content);
  }, [useRawHtml, isCustomHtml, content]);

  const findProfile = (id) => profiles?.find((p) => String(p._id) === String(id));

  const activeProfileSignature = useMemo(() => {
    const sigId = signatureProfileId
      || senderProfileId
      || senderProfileIds[0]
      || profiles?.[0]?._id;
    const sp = sigId ? findProfile(sigId) : null;
    return (sp?.signature?.trim());
  }, [signatureProfileId, senderProfileId, senderProfileIds, profiles]);

  const applySignatureToContent = (html, sig = activeProfileSignature, include = includeSignature) =>
    syncSignatureInContent(html, sig, include);

  const applyVisualEditorBlocks = (html, overrides = {}) => {
    const unsub = overrides.includeUnsubscribe ?? includeUnsubscribe;
    const sigOn = overrides.includeSignature ?? includeSignature;
    const sig = overrides.signature ?? activeProfileSignature;
    let result = stripUnsubscribe(stripSignature(html || ''));
    if (unsub) result = appendUnsubscribe(result);
    if (sigOn && sig) result = appendSignature(result, sig);
    return result;
  };

  const buildEditorContent = (html) => {
    if (useRawHtml) return html || '';
    return applyVisualEditorBlocks(html);
  };

  const handleQuillContentChange = (value) => {
    if (countUnsubscribeBlocks(value) > 1 || countSignatureBlocks(value) > 1) {
      setContent(applyVisualEditorBlocks(value));
      return;
    }
    setContent(value);
  };

  const selectedTemplate = useMemo(
    () => approvedTemplates.find((t) => String(t._id) === String(selectedTemplateId)),
    [approvedTemplates, selectedTemplateId]
  );

  const templateBody = useMemo(
    () => (selectedTemplate ? getEffectiveTemplateContent(selectedTemplate) : ''),
    [selectedTemplate]
  );

  const templateIndices = useMemo(
    () => parseIndexedVariablesFromHtml(`${templateBody}${subject}`),
    [templateBody, subject]
  );

  const handleIncludeUnsubscribeChange = (checked) => {
    setIncludeUnsubscribe(checked);
    setContent((prev) => (
      useRawHtml
        ? syncUnsubscribeInContent(prev, checked)
        : applyVisualEditorBlocks(prev, { includeUnsubscribe: checked })
    ));
  };

  const handleRawHtmlChange = (value) => {
    setContent(value);
  };

  const handleIncludeSignatureChange = (checked) => {
    setIncludeSignature(checked);
    setContent((prev) => (
      useRawHtml
        ? applySignatureToContent(prev, activeProfileSignature, checked)
        : applyVisualEditorBlocks(prev, { includeSignature: checked })
    ));
  };

  const handleSignatureProfileChange = (profileId) => {
    setSignatureProfileId(profileId);
    const sp = findProfile(profileId);
    const sig = sp?.signature?.trim();
    setContent((prev) => (
      useRawHtml
        ? syncSignatureInContent(stripSignature(prev), sig, includeSignature)
        : applyVisualEditorBlocks(stripSignature(prev), { signature: sig })
    ));
  };

  useEffect(() => {
    if (senderProfileId && !signatureProfileId) {
      setSignatureProfileId(senderProfileId);
    }
  }, [senderProfileId, signatureProfileId]);

  const isSenderConfigured = () => {
    if (senderMode === 'single') return !!senderProfileId;
    if (senderMode === 'pool') return senderProfileIds.length > 0;
    return true;
  };

  const handleCsvUpload = (e) => {
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
        header.forEach((h, idx) => {
          if (h) rowData[h] = parts[idx] != null ? parts[idx] : '';
        });
        if (!email) continue;
        const splitEmails = email.split(/[,;]/).map((se) => se.trim()).filter(Boolean);
        splitEmails.forEach((se) => {
          const normalized = normalizeEmail(se);
          if (isValidEmail(normalized)) {
            parsed.push({ name, email: normalized, source: 'CSV Upload', rowData });
          } else if (normalized) {
            skipped += 1;
          }
        });
      }
      setCsvRecipients((prev) => {
        const filtered = prev.filter((p) => p.source !== 'CSV Upload');
        return [...filtered, ...parsed];
      });
      if (skipped > 0) {
        toast.success(`CSV loaded ${parsed.length} valid recipient(s). Skipped ${skipped} invalid email(s).`);
      }
    };
    reader.readAsText(file);
  };

  const activeCsvRecipients = useMemo(() => {
    return csvRecipients.filter((r) => !excludedSources.includes(r.source) && !excludedEmails.includes(r.email));
  }, [csvRecipients, excludedSources, excludedEmails]);

  const previewRecipients = useMemo(() => {
    const selectedCrmList = allContacts.filter((c) => selectedLeadIds.includes(c._id));
    const selectedExlyList = allExlyContacts.filter((c) => selectedLeadIds.includes(c._id));
    return [
      ...activeCsvRecipients,
      ...selectedCrmList.map((c) => ({ name: c.name, email: c.email, rowData: leadToRowData(c) })),
      ...selectedExlyList.map((c) => ({ name: c.name, email: c.email, rowData: leadToRowData(c) })),
    ];
  }, [activeCsvRecipients, selectedLeadIds, allContacts, allExlyContacts]);

  const availableColumns = useMemo(
    () => collectAvailableColumns(previewRecipients),
    [previewRecipients]
  );

  const firstPreviewRecipient = previewRecipients[0] || null;
  const activePreviewRecipient = previewRecipients[previewRecipientIndex] || firstPreviewRecipient;

  const audienceHealth = useMemo(
    () => computeAudienceHealthCheck(
      previewRecipients,
      templateIndices,
      variableMapping,
      availableColumns
    ),
    [previewRecipients, templateIndices, variableMapping, availableColumns]
  );

  useEffect(() => {
    if (campaignStep !== 3 || !templateBody || !activePreviewRecipient) {
      setServerPreviewDoc('');
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setPreviewLoading(true);
      try {
        const { data } = await axios.post('/api/mail/preview', {
          content: templateBody,
          subject,
          includeSignature,
          removeUnsubscribe: !includeUnsubscribe,
          senderProfileId: senderProfileId || senderProfileIds[0] || undefined,
          sampleRecipient: activePreviewRecipient,
          variableMapping,
          theme: 'dark',
        });
        if (!cancelled) setServerPreviewDoc(data.html || '');
      } catch {
        if (!cancelled) {
          setServerPreviewDoc('<p style="padding:16px;font-family:sans-serif;color:#f87171">Preview failed to load.</p>');
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [
    campaignStep,
    templateBody,
    subject,
    activePreviewRecipient,
    variableMapping,
    includeSignature,
    includeUnsubscribe,
    senderProfileId,
    senderProfileIds,
  ]);

  const emailPreviewSrcDoc = useMemo(() => {
    if (serverPreviewDoc) return serverPreviewDoc;
    if (!content) return '';
    if (isRawHtmlPreview) return content;
    return '<p style="padding:16px">Loading preview…</p>';
  }, [serverPreviewDoc, content, isRawHtmlPreview]);

  const holySheetSourceTabs = useMemo(
    () => Array.from(new Set(csvRecipients.map((r) => r.source))),
    [csvRecipients]
  );
  const allHolySheetTabsExcluded =
    holySheetSourceTabs.length > 0 && holySheetSourceTabs.every((s) => excludedSources.includes(s));

  const fetchHolySheetData = async () => {
    setLoadingHolySheet(true);
    try {
      const res = await axios.get('/api/mail/holysheet/all');
      const rawRecs = res.data || [];
      const newRecs = [];
      let skipped = 0;

      rawRecs.forEach((rec) => {
        if (rec && rec.email) {
          const splitEmails = rec.email.split(/[,;]/).map((e) => e.trim()).filter(Boolean);
          splitEmails.forEach((se) => {
            const normalized = normalizeEmail(se);
            if (isValidEmail(normalized)) {
              newRecs.push({ ...rec, email: normalized });
            } else if (normalized) {
              skipped += 1;
            }
          });
        }
      });

      setCsvRecipients((prev) => {
        const filtered = prev.filter((p) => !p.source || p.source === 'CSV Upload');
        return [...filtered, ...newRecs];
      });
      const holySheetSources = Array.from(new Set(newRecs.map((r) => r.source).filter(Boolean)));
      setExcludedSources((prev) => [...new Set([...prev, ...holySheetSources])]);
      const skipNote = skipped > 0 ? ` Skipped ${skipped} invalid email(s).` : '';
      toast.success(`Loaded ${newRecs.length} recipients from HolySheet (${holySheetSources.length} tabs — all deselected by default). Select tabs to include.${skipNote}`);
    } catch (e) {
      toast.error('Failed to load HolySheet: ' + (e.response?.data?.error || e.message));
    }
    setLoadingHolySheet(false);
  };

  const handleHtmlUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setHtmlFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setContent(event.target.result);
      setIsCustomHtml(true);
    };
    reader.readAsText(file);
  };

  const handleAttachmentUpload = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      try {
        const uploaded = await uploadAttachmentMutation.mutateAsync(file);
        setAttachments((prev) => [...prev, uploaded]);
      } catch (err) {
        toast.error(`Failed to upload ${file.name}: ${err.response?.data?.error || err.message}`);
      }
    }
    e.target.value = '';
  };

  const buildCampaignPayload = () => {
    const selectedCrmList = allContacts.filter((c) => selectedLeadIds.includes(c._id));
    const selectedExlyList = allExlyContacts.filter((c) => selectedLeadIds.includes(c._id));
    const rawMerged = [
      ...activeCsvRecipients,
      ...selectedCrmList.map((c) => ({ name: c.name, email: c.email, rowData: leadToRowData(c) })),
      ...selectedExlyList.map((c) => ({ name: c.name, email: c.email, rowData: leadToRowData(c) })),
    ];
    const { valid: mergedRecipients } = filterValidRecipientRows(rawMerged);
    return {
      title,
      subject,
      content: templateBody,
      mailTemplateId: selectedTemplateId,
      variableMapping,
      senderProfileId: senderMode === 'single' ? senderProfileId : (senderProfileIds[0] || undefined),
      senderMode,
      senderProfileIds: senderMode === 'pool' ? senderProfileIds : [],
      ...(senderMode === 'system_resend' ? { systemProvider: 'resend' } : {}),
      ...(senderMode === 'system_smtp' ? { systemProvider: 'env_smtp' } : {}),
      includeSignature,
      removeUnsubscribe: !includeUnsubscribe,
      attachments: attachments.map((a) => ({ filename: a.filename, contentType: a.contentType, storageKey: a.storageKey })),
      leadIds: [],
      customRecipients: mergedRecipients,
    };
  };

  const resetWizardState = useCallback(() => {
    const empty = cloneWizardSnapshot(EMPTY_WIZARD_SNAPSHOT);
    applyWizardEditableState(empty, wizardSetters);
    setWizardBaseline(empty);
    setPreviewRecipientIndex(0);
    setCsvFileName('');
    setHtmlFileName('');
    setSignatureProfileId('');
  }, [wizardSetters]);

  const handleCreateCampaign = async (action = 'save_draft') => {
    if (!title || !subject || !isSenderConfigured()) {
      toast.warn('Complete title, subject, and sender in Strategy step.');
      return;
    }
    if (!selectedTemplateId || !selectedTemplate) {
      toast.warn('Select an approved template.');
      return;
    }
    if (!audienceHealth.ok) {
      toast.warn(audienceHealth.issues.find((i) => i.severity === 'error')?.message || 'Fix audience health issues first.');
      return;
    }

    const payload = { ...buildCampaignPayload(), action };
    const payloadSize = estimateJsonBytes(payload);
    if (payloadSize > PAYLOAD_SAFE_BYTES) {
      toast.error(
        `Campaign payload too large (${(payloadSize / 1024 / 1024).toFixed(1)}MB). Remove inline base64 images or reduce HTML size. ` +
        'If deploying via Vercel proxy, ensure VITE_API_URL points directly to the Render API for large campaigns.'
      );
      return;
    }
    if ((templateBody.match(/data:image/gi) || []).length > 3) {
      const proceed = window.confirm('Large inline images detected. These increase payload size and may fail in production. Continue anyway?');
      if (!proceed) return;
    }

    await createCampaignMutation.mutateAsync(payload);

    toast.success(
      action === 'dispatch'
        ? 'Campaign created and dispatch started.'
        : 'Campaign saved as draft. Dispatch from the list when ready.'
    );

    resetWizardState();
    if (standaloneWizard) {
      navigate('/emails');
    } else {
      onExit?.();
    }
  };

  const canAdvanceFromStep = (step) => {
    if (step === 1) {
      return title && subject && isSenderConfigured() && selectedTemplateId;
    }
    if (step === 2) {
      return previewRecipients.length > 0 && audienceHealth.ok;
    }
    return true;
  };

  const exitWizard = useCallback(async () => {
    if (wizardDirty) {
      const ok = await confirm({
        title: 'Discard campaign draft?',
        message: 'Unsaved campaign setup will be lost.',
        confirmLabel: 'Discard',
        type: 'danger',
      });
      if (!ok) return;
      resetWizardState();
    }
    onExit?.();
  }, [wizardDirty, confirm, resetWizardState, onExit]);

  const handleCancelOrBack = () => {
    if (campaignStep === 1) {
      exitWizard();
    } else {
      setCampaignStep(campaignStep - 1);
    }
  };

  const handleNextStep = () => {
    if (!canAdvanceFromStep(campaignStep)) {
      if (campaignStep === 1) toast.warn('Complete title, subject, sender, and template.');
      else toast.warn('Add audience and fix health check issues.');
      return;
    }
    setCampaignStep(campaignStep + 1);
  };

  const handleSendTest = async () => {
    if (!testCampaignEmail) { toast.warn('Enter test email'); return; }
    if (!selectedTemplate) { toast.warn('Select a template'); return; }
    if (senderMode === 'single' && !senderProfileId) {
      toast.warn('Select sender in Setup step.');
      return;
    }
    try {
      await axios.post('/api/mail/test-campaign', {
        subject,
        content: templateBody,
        testEmail: testCampaignEmail,
        senderProfileId: senderProfileId || senderProfileIds[0] || undefined,
        senderProfileIds: senderMode === 'pool' ? senderProfileIds : [],
        senderMode,
        includeSignature,
        removeUnsubscribe: !includeUnsubscribe,
        variableMapping,
        sampleRecipient: activePreviewRecipient,
      });
      toast.success(`Test email sent to ${testCampaignEmail}`);
    } catch (e) {
      toast.error('Failed to send test: ' + (e.response?.data?.error || e.message));
    }
  };

  useUnsavedChanges({
    baseline: wizardBaseline,
    draft: currentWizardState,
    hasChanges: wizardDirty,
    onSave: async () => {
      if (campaignStep < 3) {
        toast.warn('Complete Strategy and Audience steps, then save from Pre-flight.');
        return;
      }
      await handleCreateCampaign('save_draft');
    },
    onCancel: revertWizardEdits,
    isSaving: createCampaignMutation.isPending,
    enabled: true,
    elevated: true,
    fieldLabels: {
      title: 'Campaign title',
      subject: 'Subject',
      selectedTemplateId: 'Template',
      selectedLeadIds: 'Recipients',
    },
  });

  return {
    profiles,
    approvedTemplates,
    fetchLoadingPhrase,
    campaignStep,
    setCampaignStep,
    previewRecipientIndex,
    setPreviewRecipientIndex,
    previewLoading,
    loadingHolySheet,
    title,
    setTitle,
    subject,
    setSubject,
    senderProfileId,
    setSenderProfileId,
    senderMode,
    setSenderMode,
    senderProfileIds,
    setSenderProfileIds,
    includeSignature,
    includeUnsubscribe,
    attachments,
    setAttachments,
    selectedTemplateId,
    setSelectedTemplateId,
    variableMapping,
    setVariableMapping,
    testCampaignEmail,
    setTestCampaignEmail,
    searchTerm,
    setSearchTerm,
    activeTab,
    setActiveTab,
    filters,
    setFilters,
    allContacts,
    allExlyContacts,
    contactsLoading,
    exlyContactsLoading,
    filteredContacts,
    filteredExlyContacts,
    exlyOfferingsList,
    csvRecipients,
    setCsvRecipients,
    csvFileName,
    setCsvFileName,
    excludedSources,
    setExcludedSources,
    excludedEmails,
    setExcludedEmails,
    externalSearch,
    setExternalSearch,
    selectedLeadIds,
    setSelectedLeadIds,
    activeCsvRecipients,
    previewRecipients,
    availableColumns,
    activePreviewRecipient,
    audienceHealth,
    emailPreviewSrcDoc,
    allHolySheetTabsExcluded,
    selectedTemplate,
    templateBody,
    templateIndices,
    createCampaignMutation,
    handleIncludeSignatureChange,
    handleIncludeUnsubscribeChange,
    handleCsvUpload,
    fetchHolySheetData,
    handleAttachmentUpload,
    handleCreateCampaign,
    canAdvanceFromStep,
    handleCancelOrBack,
    handleNextStep,
    handleSendTest,
    loadCrmContactsData,
    loadExlyContactsData,
    onOpenProfiles,
    onOpenTemplates,
    holySheetTab,
    setHolySheetTab,
    activeExternalTab,
    setActiveExternalTab,
    handleQuillContentChange,
    handleRawHtmlChange,
    handleHtmlUpload,
    buildEditorContent,
  };
}
