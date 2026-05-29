import React, { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Mail, Upload, Plus, Play, CheckCircle2, AlertCircle, FileCode, Users, Trash2, Zap, BarChart2, RefreshCw, Send, Check, Search, Filter, X, UserMinus, Edit, Eye, Save
} from 'lucide-react';
import { Card, Button, Input, Badge, DataTable, StatCard, PageSkeleton, TabSwitcher } from '../ui';
import NexusDropdown from '../ui/NexusDropdown';
import {
  useMailProfiles, useMailCampaigns, useMailStats, useCreateMailProfile,
  useDeleteMailProfile, useCreateCampaign, useSendCampaign, useDeleteCampaign, useLiveLeads, useUserDirectory, useScanBounces, useCumulativeAnalytics,
  useMailTemplates, useSaveMailTemplate, useDeleteMailTemplate, useSyncUnsubscribed, useLocationLeads, useContacts, useUpdateMailProfile
} from '../../hooks/useTaskmasterQueries';
import { format } from 'date-fns';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import axios from 'axios';
import { signaturePngBase64 } from '../../utils/signaturePng';
import { iconIg, iconX, iconYt } from '../../utils/signatureIcons';

const defaultSignatureTemplate = `<p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>
<div>
  <img src="${signaturePngBase64}" alt="The Shakti Collective" width="100" style="display: block; margin-bottom: 10px;">
  <div style="font-size: 18px; font-weight: bold; color: #C15717; margin-top: 10px;">Redacted User</div>
  <div style="font-size: 14px; color: #222222;">Founder, Cinematographer & Web Developer</div>
  <div style="font-size: 13px; font-style: italic; color: #444444;">Automation, Production & Visual Strategy</div>
  <div style="font-size: 13px; margin-top: 10px;">
    <strong>P:</strong> +91 85914 99393<br>
    <strong>E:</strong> <a href="mailto:redacted@example.com" style="color: #222222; text-decoration: underline;">redacted@example.com</a> | 
    <a href="https://tsccoreknot.com" style="color: #C15717; text-decoration: underline;">tsccoreknot.com</a>
  </div>
  <div style="margin-top: 10px;">
    <a href="https://instagram.com/theshakticollective.in" style="text-decoration: none; display: inline-block; margin-right: 4px;">
      <img src="${iconIg}" alt="Instagram" width="24" height="24" style="border: 0;">
    </a>
    <a href="https://youtube.com/@theshakticollective" style="text-decoration: none; display: inline-block;">
      <img src="${iconYt}" alt="YouTube" width="24" height="24" style="border: 0;">
    </a>
  </div>
</div>`;

export default function AdminMailContent() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: profiles = [], isLoading: profilesLoading, refetch: refetchProfiles } = useMailProfiles();
  const { data: campaigns = [], isLoading: campaignsLoading, refetch: refetchCampaigns } = useMailCampaigns();
  const { data: stats, refetch: refetchStats } = useMailStats();
  const { data: team = [] } = useUserDirectory();
  const { data: cumulativeAnalytics } = useCumulativeAnalytics();

  // Filter state for CRM leads
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [filters, setFilters] = useState({
    leadStatus: 'all',
    exlyOffering: 'all'
  });

  const [allContacts, setAllContacts] = useState([]);
  const [allExlyContacts, setAllExlyContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [exlyContactsLoading, setExlyContactsLoading] = useState(false);
  const [templateVariables, setTemplateVariables] = useState({});
  const [showVariableWarning, setShowVariableWarning] = useState(false);
  const [testCampaignEmail, setTestCampaignEmail] = useState('redacted@example.com');
  const [showHtmlPasteModal, setShowHtmlPasteModal] = useState(false);
  const [htmlPasteText, setHtmlPasteText] = useState('');
  const [isCustomHtml, setIsCustomHtml] = useState(false);
  const [useRawHtml, setUseRawHtml] = useState(false);
  const [previewMode, setPreviewMode] = useState('desktop');

  const loadCrmContactsData = async () => {
    setContactsLoading(true);
    try {
      const res = await axios.get('/api/crm/leads?limit=100000');
      const leads = res.data?.leads || res.data || [];
      setAllContacts(leads.filter(l => l.email && !l.exlyOfferings));
    } catch (e) {
      alert('Failed to load CRM Contacts: ' + e.message);
    }
    setContactsLoading(false);
  };

  const loadExlyContactsData = async () => {
    setExlyContactsLoading(true);
    try {
      const res = await axios.get('/api/crm/leads?limit=100000');
      const leads = res.data?.leads || res.data || [];
      setAllExlyContacts(leads.filter(l => l.email && l.exlyOfferings && Array.isArray(l.exlyOfferings)));
    } catch (e) {
      alert('Failed to load Exly Contacts: ' + e.message);
    }
    setExlyContactsLoading(false);
  };

  const filteredContacts = useMemo(() => {
    return allContacts.filter(c => {
      if (!c.email) return false;
      if (searchTerm && !c.name?.toLowerCase().includes(searchTerm.toLowerCase()) && !c.email?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (activeTab === 'fresh' && c.leadStatus !== 'Fresh') return false;
      if (activeTab === 'contacted' && c.leadStatus !== 'Contacted') return false;
      if (filters.leadStatus !== 'all' && c.leadStatus !== filters.leadStatus) return false;
      return true;
    });
  }, [allContacts, searchTerm, activeTab, filters]);

  const filteredExlyContacts = useMemo(() => {
    return allExlyContacts.filter(c => {
      if (!c.email) return false;
      if (searchTerm && !c.name?.toLowerCase().includes(searchTerm.toLowerCase()) && !c.email?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (activeTab === 'fresh' && c.leadStatus !== 'Fresh') return false;
      if (activeTab === 'contacted' && c.leadStatus !== 'Contacted') return false;
      if (filters.leadStatus !== 'all' && c.leadStatus !== filters.leadStatus) return false;
      if (filters.exlyOffering !== 'all' && Array.isArray(c.exlyOfferings)) {
        const offeringNames = c.exlyOfferings.map(o => typeof o === 'string' ? o : o?.title || o?.offeringId).filter(Boolean);
        if (!offeringNames.includes(filters.exlyOffering)) return false;
      } else if (filters.exlyOffering !== 'all' && c.exlyOfferingTitle !== filters.exlyOffering) {
        return false;
      }
      return true;
    });
  }, [allExlyContacts, searchTerm, activeTab, filters]);

  const totalContacts = filteredContacts.length;

  const exlyOfferingsList = useMemo(() => {
    const list = new Set();
    allExlyContacts.forEach(c => {
      if (Array.isArray(c.exlyOfferings)) {
        c.exlyOfferings.forEach(o => {
          const name = typeof o === 'string' ? o : o?.title || o?.offeringId;
          if (name) list.add(name);
        });
      } else if (c.exlyOfferingTitle) {
        list.add(c.exlyOfferingTitle);
      }
    });
    return Array.from(list);
  }, [allExlyContacts]);

  const createProfileMutation = useCreateMailProfile();
  const updateProfileMutation = useUpdateMailProfile();
  const deleteProfileMutation = useDeleteMailProfile();
  const createCampaignMutation = useCreateCampaign();
  const sendCampaignMutation = useSendCampaign();
  const deleteCampaignMutation = useDeleteCampaign();
  const scanBouncesMutation = useScanBounces();
  const syncUnsubscribedMutation = useSyncUnsubscribed();

  // Navigation within Mail tab
  const [mode, setMode] = useState('campaigns'); // 'campaigns', 'new_campaign', 'profiles'
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [selectedLocationForModal, setSelectedLocationForModal] = useState(null);

  // Templates Management State
  const { data: templates = [], refetch: refetchTemplates } = useMailTemplates();
  const saveTemplateMutation = useSaveMailTemplate();
  const deleteTemplateMutation = useDeleteMailTemplate();

  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [templateType, setTemplateType] = useState('session_reminder');
  const [templateParams, setTemplateParams] = useState({
    logoText: 'The Shakti Collective',
    titleText: 'Your Upcoming Session Alignment',
    dateText: 'Tomorrow @ 4:00 PM IST',
    locationText: 'Main Shakti Hall',
    messageText: 'Your upcoming immersive musical alignment and production session is fast approaching. We are preparing our studio environment for an extraordinary session of creative transcendence.',
    ctaText: 'Access Collective Portal',
    ctaUrl: 'https://theshakticollective.in',
    bannerImg: '',
    footerText: 'The Shakti Collective • indigenously rooted music',
    feature1Title: 'Advanced routing pipelines',
    feature1Text: 'Sales rep assignment metrics are now protected under isolated MongoDB transactions to eliminate duplicate allocations.',
    feature2Title: 'Dynamic geolocation metrics',
    feature2Text: 'We now track exact client locations on email open and click events to provide complete geographical breakdown analytics.'
  });

  const defaultReminderHTML = (params) => {
    const { logoText = 'The Shakti Collective', dateText = 'Tomorrow @ 4:00 PM IST', locationText = 'Main Shakti Hall', messageText = 'Your upcoming immersive musical alignment and production session is fast approaching. We are preparing our studio environment for an extraordinary session of creative transcendence.', ctaUrl = 'https://theshakticollective.in', ctaText = 'Access Collective Portal', bannerImg = '', footerText = 'The Shakti Collective • indigenously rooted music' } = params;
    const bannerImgTag = bannerImg
      ? `<tr>
          <td align="center" style="padding-bottom: 24px;">
            <img src="${bannerImg}" alt="Session Banner" style="width: 100%; max-height: 220px; object-fit: cover; border-radius: 16px; border: 1px solid #1F2937;" />
          </td>
        </tr>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Session Reminder: ${logoText}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0B0F19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F1F5F9; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0B0F19; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #111827; border: 1px solid #1F2937; border-radius: 24px; padding: 48px 40px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          <tr>
            <td align="center" style="padding-bottom: 32px; border-bottom: 1px solid #1F2937; margin-bottom: 24px;">
              <h1 style="font-size: 28px; font-weight: 800; color: #38BDF8; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 2px;">${logoText}</h1>
              <p style="font-size: 14px; font-weight: 600; color: #94A3B8; margin: 0; text-transform: uppercase; letter-spacing: 4px;">Exclusive Session Reminder</p>
            </td>
          </tr>
          ${bannerImgTag}
          <tr>
            <td style="padding: 24px 0 28px 0; font-size: 16px; line-height: 1.6; color: #E2E8F0;">
              <p style="margin: 0 0 20px 0;">Namaste <strong>Valued Member</strong>,</p>
              <p style="margin: 0 0 24px 0;">${messageText}</p>
              
              <div style="background-color: #1E293B; border-left: 4px solid #38BDF8; padding: 20px 24px; border-radius: 12px; margin-bottom: 32px;">
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #94A3B8; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Session Details</p>
                <p style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: #F8FAFC;">Shakti Studio Alignment</p>
                <p style="margin: 0; font-size: 14px; color: #CBD5E1;">Date: ${dateText} | Location: ${locationText}</p>
              </div>

              <p style="margin: 0 0 36px 0; text-align: center;">Please confirm your attendance or review session prerequisites on our official collective portal.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 40px;">
              <a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #0284C7 0%, #0369A1 100%); color: #FFFFFF; font-size: 16px; font-weight: 700; text-decoration: none; padding: 18px 40px; border-radius: 16px; text-transform: uppercase; letter-spacing: 1.5px; box-shadow: 0 10px 25px -5px rgba(2, 132, 199, 0.5);">${ctaText}</a>
            </td>
          </tr>
          <tr>
            <td align="center" style="border-top:1px solid #1f2937;padding-top:20px;font-size:11px;color:#64748b;">
              <p style="margin:0;">The Shakti Collective • <a href="{{unsubscribe_url}}" style="color:#38bdf8;text-decoration:none;">Unsubscribe</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  };

  const defaultMarketingHTML = (params) => {
    const { titleText = 'Unlocking New Possibilities', messageText = 'We are thrilled to bring you our latest updates. We have optimized our pipeline to deliver maximum performance and reliability. Join us to explore how these features can accelerate your workflow.', ctaUrl = 'https://theshakticollective.in', ctaText = 'Explore Features', bannerImg = '' } = params;
    const bannerImgTag = bannerImg
      ? `<tr>
          <td>
            <img src="${bannerImg}" alt="Banner" style="width:100%;height:auto;display:block;border-bottom:1px solid #1f2937;" />
          </td>
        </tr>`
      : '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Exclusive Announcement</title>
</head>
<body style="margin:0;padding:0;background-color:#0b0f19;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0b0f19;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#111827;border:1px solid #1f2937;border-radius:24px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
          ${bannerImgTag}
          <tr>
            <td style="padding:40px 32px;">
              <h2 style="font-size:24px;font-weight:800;color:#38bdf8;margin:0 0 16px 0;text-transform:uppercase;letter-spacing:1px;">${titleText}</h2>
              <p style="font-size:15px;line-height:1.6;color:#cbd5e1;margin:0 0 24px 0;">Hello {{name}},</p>
              <p style="font-size:15px;line-height:1.6;color:#cbd5e1;margin:0 0 24px 0;">${messageText}</p>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:32px 0;">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#0284c7 0%,#0369a1 100%);color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:16px 36px;border-radius:12px;text-transform:uppercase;letter-spacing:1px;box-shadow:0 10px 15px -3px rgba(2,132,199,0.3);">${ctaText}</a>
                  </td>
                </tr>
              </table>
              <p style="font-size:14px;line-height:1.6;color:#94a3b8;margin:0;text-align:center;">Have questions? Reply directly to this email or visit our Help Center.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="background-color:#0f172a;padding:24px;font-size:11px;color:#64748b;border-top:1px solid #1f2937;">
              <p style="margin:0 0 8px 0;">You are receiving this because you subscribed to our updates.</p>
              <p style="margin:0;"><a href="{{unsubscribe_url}}" style="color:#38bdf8;text-decoration:none;">Unsubscribe</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  };

  const defaultNewsletterHTML = (params) => {
    const { logoText = 'SHAKTI DIGEST', titleText = 'This Month at the Collective', messageText = "Welcome to this month's digest. We have been working hard to push boundary lines in music production, artist routing networks, and performance optimization.", feature1Title = 'Advanced routing pipelines', feature1Text = 'Sales rep assignment metrics are now protected under isolated MongoDB transactions to eliminate duplicate allocations.', feature2Title = 'Dynamic geolocation metrics', feature2Text = 'We now track exact client locations on email open and click events to provide complete geographical breakdown analytics.', ctaUrl = 'https://theshakticollective.in', ctaText = 'Read Full Blog', footerText = 'The Shakti Collective • indigenously rooted music' } = params;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Monthly Newsletter</title>
</head>
<body style="margin:0;padding:0;background-color:#0b0f19;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0b0f19;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#111827;border:1px solid #1f2937;border-radius:24px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
          <tr align="center" style="background-color:#1e293b;padding:32px 24px;border-bottom:1px solid #1f2937;">
            <td align="center" style="padding: 32px 24px;">
              <h1 style="font-size:24px;font-weight:800;color:#38bdf8;margin:0;text-transform:uppercase;letter-spacing:3px;">${logoText}</h1>
              <p style="font-size:11px;color:#94a3b8;margin:6px 0 0 0;text-transform:uppercase;letter-spacing:4px;">Monthly Newsletter & updates</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="font-size:14px;color:#94a3b8;margin:0 0 8px 0;font-weight:bold;text-transform:uppercase;">Update for {{name}}</p>
              <h2 style="font-size:20px;font-weight:700;color:#f8fafc;margin:0 0 16px 0;">${titleText}</h2>
              <p style="font-size:15px;line-height:1.6;color:#cbd5e1;margin:0 0 20px 0;">${messageText}</p>
              
              <h3 style="font-size:16px;color:#38bdf8;margin:24px 0 8px 0;font-weight:bold;">1. ${feature1Title}</h3>
              <p style="font-size:14px;line-height:1.6;color:#cbd5e1;margin:0 0 16px 0;">${feature1Text}</p>

              <h3 style="font-size:16px;color:#38bdf8;margin:24px 0 8px 0;font-weight:bold;">2. ${feature2Title}</h3>
              <p style="font-size:14px;line-height:1.6;color:#cbd5e1;margin:0 0 24px 0;">${feature2Text}</p>
              
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:24px 0;">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" style="display:inline-block;background:#0284c7;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:8px;text-transform:uppercase;">${ctaText}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="background-color:#0f172a;padding:20px;font-size:11px;color:#64748b;border-top:1px solid #1f2937;">
              <p style="margin:0 0 6px 0;">${footerText}</p>
              <p style="margin:0;"><a href="{{unsubscribe_url}}" style="color:#38bdf8;text-decoration:none;">Unsubscribe</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  };

  const defaultPlainTextHTML = (params) => {
    const { messageText = 'Hello {{name}},\n\nThis is a plain email update from the collective.' } = params;
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Update</title>
</head>
<body style="font-family: monospace; font-size: 14px; line-height: 1.5; color: #cbd5e1; background-color: #0b0f19; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; padding: 24px; border-radius: 12px;">
    <pre style="white-space: pre-wrap; font-family: inherit; margin: 0 0 24px 0;">${messageText}</pre>
    <div style="border-top: 1px solid #1f2937; padding-top: 12px; font-size: 11px; color: #64748b;">
      <a href="{{unsubscribe_url}}" style="color: #ef4444; text-decoration: underline;">Unsubscribe</a>
    </div>
  </div>
</body>
</html>`;
  };

  useEffect(() => {
    if (isCustomHtml) return; // Don't overwrite custom HTML
    if (templateType === 'session_reminder') {
      setTemplateContent(defaultReminderHTML(templateParams));
    } else if (templateType === 'marketing') {
      setTemplateContent(defaultMarketingHTML(templateParams));
    } else if (templateType === 'newsletter') {
      setTemplateContent(defaultNewsletterHTML(templateParams));
    } else {
      setTemplateContent(defaultPlainTextHTML(templateParams));
    }
  }, [templateType, templateParams, isCustomHtml]);

  const handleBannerUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setTemplateParams({ ...templateParams, bannerImg: event.target.result });
    };
    reader.readAsDataURL(file);
  };


  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowPreviewModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // New Profile State
  const [newProfile, setNewProfile] = useState({
    name: '', email: '', smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '', signature: defaultSignatureTemplate
  });

  // New Campaign State
  const [campaignStep, setCampaignStep] = useState(1);
  const [holySheetTab, setHolySheetTab] = useState('');
  const [loadingHolySheet, setLoadingHolySheet] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState(null);

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [senderProfileId, setSenderProfileId] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [csvRecipients, setCsvRecipients] = useState([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [htmlFileName, setHtmlFileName] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [excludedSources, setExcludedSources] = useState([]);
  const [excludedEmails, setExcludedEmails] = useState([]);

  const [removeUnsubscribe, setRemoveUnsubscribe] = useState(true);

  const isRawHtmlPreview = useMemo(() => {
    return useRawHtml
      || isCustomHtml
      || /^\s*<!DOCTYPE/i.test(content)
      || /^\s*<html[\s>]/i.test(content);
  }, [useRawHtml, isCustomHtml, content]);

  const emailPreviewSrcDoc = useMemo(() => {
    if (!content) return '';
    if (isRawHtmlPreview) return content;
    const sanitized = DOMPurify.sanitize(content);
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:16px;">${sanitized}</body></html>`;
  }, [content, isRawHtmlPreview]);

  useEffect(() => {
    if (senderProfileId && profiles) {
      const sp = profiles.find(p => p._id === senderProfileId);
      if (sp && sp.signature) {
        setContent(prev => {
          if (prev.includes(sp.signature)) return prev;
          return prev + (prev ? '<br/><br/>' : '') + sp.signature;
        });
      }
    }
  }, [senderProfileId, profiles]);

  // Handle CSV File Upload
  const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2) return;

      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      const emailIdx = header.findIndex(h => h.includes('email'));
      const nameIdx = header.findIndex(h => h.includes('name'));

      if (emailIdx === -1) {
        alert('Could not detect "email" column in CSV header.');
        return;
      }

      const parsed = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim());
        const email = parts[emailIdx];
        const name = nameIdx !== -1 ? parts[nameIdx] : '';
        if (email && email.includes('@')) {
          const splitEmails = email.split(/[,;]/).map(e => e.trim()).filter(Boolean);
          splitEmails.forEach(se => {
            if (se.includes('@')) {
              parsed.push({ name, email: se, source: 'CSV Upload' });
            }
          });
        }
      }
      setCsvRecipients(prev => {
        const filtered = prev.filter(p => p.source !== 'CSV Upload');
        return [...filtered, ...parsed];
      });
    };
    reader.readAsText(file);
  };

  const handleCreateProfile = async (e) => {
    e.preventDefault();
    if (!newProfile.name || !newProfile.email || !newProfile.smtpHost || !newProfile.smtpUser || !newProfile.smtpPass) {
      alert('Please fill in all SMTP fields');
      return;
    }
    if (editingProfileId) {
      await updateProfileMutation.mutateAsync({ id: editingProfileId, ...newProfile });
      setEditingProfileId(null);
    } else {
      await createProfileMutation.mutateAsync(newProfile);
    }
    setNewProfile({ name: '', email: '', smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '', signature: defaultSignatureTemplate });
  };

  const [activeExternalTab, setActiveExternalTab] = useState('ALL');
  const [externalSearch, setExternalSearch] = useState('');

  const activeCsvRecipients = useMemo(() => {
    return csvRecipients.filter(r => !excludedSources.includes(r.source) && !excludedEmails.includes(r.email));
  }, [csvRecipients, excludedSources, excludedEmails]);

  const fetchHolySheetData = async () => {
    setLoadingHolySheet(true);
    try {
      const res = await axios.get('/api/mail/holysheet/all');
      const rawRecs = res.data || [];
      const newRecs = [];
      
      // Process and split HolySheet compound emails
      rawRecs.forEach(rec => {
        if (rec && rec.email) {
          const splitEmails = rec.email.split(/[,;]/).map(e => e.trim()).filter(Boolean);
          splitEmails.forEach(se => {
            if (se.includes('@')) {
              newRecs.push({ ...rec, email: se });
            }
          });
        }
      });
      
      setCsvRecipients(prev => {
        const filtered = prev.filter(p => !p.source || p.source === 'CSV Upload');
        return [...filtered, ...newRecs];
      });
      alert(`Loaded ${newRecs.length} recipients from HolySheet!`);
    } catch (e) {
      alert('Failed to load HolySheet: ' + (e.response?.data?.error || e.message));
    }
    setLoadingHolySheet(false);
  };

  // Handle HTML File Upload
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

  // Handle Attachments Upload
  const handleAttachmentUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachments(prev => [...prev, {
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          content: event.target.result
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleCreateCampaign = async () => {
    if (!title || !subject || !content || !senderProfileId) {
      alert('Please complete campaign title, subject, content, and select a sender profile.');
      return;
    }
    if (selectedLeadIds.length === 0 && csvRecipients.length === 0) {
      alert('Please select CRM leads or upload a recipient CSV.');
      return;
    }

    const selectedCrmList = allContacts.filter(c => selectedLeadIds.includes(c._id));
    const selectedExlyList = allExlyContacts.filter(c => selectedLeadIds.includes(c._id));
    const mergedRecipients = [
      ...activeCsvRecipients,
      ...selectedCrmList.map(c => ({ name: c.name, email: c.email })),
      ...selectedExlyList.map(c => ({ name: c.name, email: c.email }))
    ];

    // Replace variables in content
    let processedContent = content;
    const detectedVars = new Set();
    const varRegex = /\{\{(\w+)\}\}/g;
    let match;
    while ((match = varRegex.exec(content)) !== null) {
      detectedVars.add(match[1]);
    }

    await createCampaignMutation.mutateAsync({
      title,
      subject,
      content: processedContent,
      senderProfileId,
      attachments,
      leadIds: [],
      customRecipients: mergedRecipients,
      removeUnsubscribe,
      templateVariables: detectedVars.size > 0 ? Array.from(detectedVars) : []
    });

    await saveTemplateMutation.mutateAsync({
      name: `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_template.html`,
      content
    });

    setTitle('');
    setSubject('');
    setContent('');
    setAttachments([]);
    setSelectedLeadIds([]);
    setCsvRecipients([]);
    setCsvFileName('');
    setHtmlFileName('');
    setIsCustomHtml(false);
    setUseRawHtml(false);
    setMode('campaigns');
  };



  const campaignColumns = [
    {
      header: 'Campaign Information',
      render: (row) => (
        <div>
          <span className="font-bold text-xs tracking-tight">{row.title}</span>
          <span className="text-[10px] text-[var(--color-text-muted)] block font-mono">{row.subject}</span>
        </div>
      )
    },
    {
      header: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'Completed' ? 'success' : row.status === 'Sending' ? 'warning' : 'info'}>
          {row.status}
        </Badge>
      )
    },
    {
      header: 'Recipients & Delivery',
      render: (row) => (
        <div className="flex items-center gap-4">
          <div className="text-[11px] font-bold">
            {row.stats?.total || 0} Target
          </div>
          <div className="text-[11px] font-bold text-emerald-500">
            {row.stats?.sent || 0} Sent
          </div>
        </div>
      )
    },
    {
      header: 'Created',
      render: (row) => (
        <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase">
          {format(new Date(row.createdAt), 'MMM dd, yyyy')}
        </span>
      )
    },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.status === 'Draft' && (
            <Button
              size="sm"
              variant="primary"
              onClick={(e) => { e.stopPropagation(); sendCampaignMutation.mutate(row._id); }}
              disabled={sendCampaignMutation.isPending}
            >
              <Play size={12} /> Dispatch Now
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-rose-500 hover:bg-rose-500/10"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm('Are you sure you want to delete this campaign? All associated metrics and tracking data will be permanently removed.')) {
                deleteCampaignMutation.mutate(row._id, {
                  onSuccess: () => {
                    if (selectedCampaign?._id === row._id) setSelectedCampaign(null);
                    window.location.reload();
                  }
                });
              }
            }}
            disabled={deleteCampaignMutation.isPending}
            title="Delete Campaign & Data"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      )
    }
  ];

  if (profilesLoading && campaignsLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      {/* Top Header & Mode Switcher */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--color-bg-border)]">
        <div className="flex items-center gap-2">
          <Button
            variant={mode === 'campaigns' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setMode('campaigns')}
          >
            <BarChart2 size={14} /> Campaigns ({campaigns.length})
          </Button>
          <Button
            variant={mode === 'new_campaign' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setMode('new_campaign')}
          >
            <Plus size={14} /> Create Campaign
          </Button>
          <Button
            variant={mode === 'templates' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setMode('templates')}
          >
            <FileCode size={14} /> Manage Templates ({templates.length})
          </Button>
          <Button
            variant={mode === 'analytics' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setMode('analytics')}
          >
            <BarChart2 size={14} /> Aggregate Analytics
          </Button>
          <Button
            variant={mode === 'profiles' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setMode('profiles')}
          >
            <Zap size={14} /> SMTP Profiles ({profiles.length})
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (profiles.length === 0) {
                alert('Please configure an SMTP Profile first');
                return;
              }
              scanBouncesMutation.mutate(profiles[0]?._id);
            }}
            disabled={scanBouncesMutation.isPending || profiles.length === 0}
          >
            <RefreshCw size={14} className={scanBouncesMutation.isPending ? 'animate-spin' : ''} /> Scan Bounces
          </Button>
        </div>
      </div>

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <StatCard label="Total Campaigns" value={stats?.totalCampaigns || campaigns.length} icon={Mail} variant="info" />
        <StatCard label="Emails Dispatched" value={stats?.totalSent || 0} icon={Send} variant="mint" />
        <StatCard label="Bounced / Failed" value={stats?.totalBounced || 0} icon={AlertCircle} variant="rose" />
        <StatCard label="Opens Tracked" value={stats?.totalOpened || 0} icon={CheckCircle2} variant="slate" />
        <StatCard
          label="Unsubscribed"
          value={stats?.totalUnsubscribed || 0}
          icon={UserMinus}
          variant="warning"
          onClick={() => window.open('https://docs.google.com/spreadsheets/d/1BuHfbhY21cFoSHaanH8Q5Rg_80s3zHZY9snwzCroRe0/edit?usp=sharing', '_blank')}
        />
      </div>

      {/* Mode: Campaigns List */}
      {mode === 'campaigns' && (
        <Card className="p-0 overflow-hidden border border-[var(--color-bg-border)]">
          <DataTable columns={campaignColumns} data={campaigns} onRowClick={(row) => navigate(`/campaign/${row.campaignId || row._id}`, { state: { from: location.pathname } })} />
          {campaigns.length === 0 && (
            <div className="p-16 text-center opacity-30">
              <Mail size={48} className="mx-auto mb-4" />
              <p className="text-xs font-black uppercase tracking-widest">No campaigns created yet</p>
            </div>
          )}
        </Card>
      )}

      {/* Mode: New Campaign Builder */}
      {mode === 'new_campaign' && (
        <Card className="p-6 space-y-6 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)]">
          <div className="flex items-center justify-between border-b border-[var(--color-bg-border)] pb-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-action-primary)] flex items-center gap-2">
              <Mail size={16} /> Campaign Architect
            </h3>
            <div className="flex items-center gap-3">
              {[1, 2, 3, 4].map(s => (
                <div key={s} className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] ${campaignStep >= s ? 'bg-[var(--color-action-primary)] text-white shadow-[0_0_10px_var(--color-action-primary)]' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'}`}>
                  {s}
                </div>
              ))}
            </div>
          </div>

          {campaignStep === 1 && (
            <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Campaign Title" placeholder="e.g. May Product Release" value={title} onChange={e => setTitle(e.target.value)} />
                <Input label="Email Subject Line" placeholder="e.g. Unlocking Next-Gen Capabilities" value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">Sender Profile (SMTP)</label>
                {profiles.length === 0 ? (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between">
                    <span className="text-xs text-amber-500 font-bold">No SMTP Profiles configured. Please configure a profile first.</span>
                    <Button size="sm" onClick={() => setMode('profiles')}>Configure Profile</Button>
                  </div>
                ) : (
                  <select
                    value={senderProfileId}
                    onChange={e => setSenderProfileId(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-xl text-sm outline-none"
                  >
                    <option value="">-- Select Sender Profile --</option>
                    {profiles.map(p => (
                      <option key={p._id} value={p._id}>{p.name} ({p.email})</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

          {campaignStep === 2 && (
            <div className="space-y-6 animate-in fade-in">
              <h4 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
                <Users size={14} /> Target Audience ({selectedLeadIds.length + activeCsvRecipients.length} Selected)
              </h4>
              {/* External Sources Container */}
              <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--color-bg-border)] pb-3">
                  <h4 className="text-xs font-bold uppercase tracking-tight flex items-center gap-2">
                    <Users size={14} /> External Data (HolySheet & CSV)
                  </h4>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] hover:border-[var(--color-action-primary)] rounded-lg text-[10px] font-black uppercase tracking-wider transition-all">
                      <Upload size={12} className="text-[var(--color-action-primary)]" />
                      {csvFileName ? 'CSV Loaded' : 'Upload CSV'}
                      <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
                    </label>
                    <Button size="xs" onClick={fetchHolySheetData} disabled={loadingHolySheet}>
                      <RefreshCw size={12} className={loadingHolySheet ? 'animate-spin' : ''} /> {loadingHolySheet ? 'Loading...' : 'Fetch HolySheet'}
                    </Button>
                    {csvRecipients.length > 0 && (
                      <Button size="xs" variant="ghost" onClick={() => { setCsvRecipients([]); setExcludedSources([]); setExcludedEmails([]); setCsvFileName(''); }} className="text-rose-500 hover:bg-rose-500/10 ml-2">Clear All</Button>
                    )}
                  </div>
                </div>

                {csvRecipients.length === 0 ? (
                  <div className="p-10 text-center border border-dashed border-[var(--color-bg-border)] rounded-xl opacity-50 flex flex-col items-center justify-center bg-[var(--color-bg-primary)]">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">No External Data Loaded</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Tab Selection Chips */}
                    <div className="flex flex-wrap gap-2">
                      {Array.from(new Set(csvRecipients.map(r => r.source))).map(src => {
                        const count = csvRecipients.filter(r => r.source === src).length;
                        const isActive = !excludedSources.includes(src);
                        return (
                          <div
                            key={src}
                            onClick={() => {
                              if (isActive) setExcludedSources(prev => [...prev, src]);
                              else setExcludedSources(prev => prev.filter(s => s !== src));
                            }}
                            className={`cursor-pointer px-3 py-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-2 transition-all ${isActive ? 'bg-[var(--color-action-primary)]/10 border-[var(--color-action-primary)]/30 text-[var(--color-action-primary)]' : 'bg-[var(--color-bg-primary)] border-[var(--color-bg-border)] text-[var(--color-text-muted)]'}`}
                          >
                            {isActive ? <CheckCircle2 size={12} /> : <div className="w-3 h-3 rounded-full border border-[var(--color-text-muted)]" />}
                            {src} ({count})
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2">
                      <Input placeholder="Search Name or Email..." value={externalSearch} onChange={e => setExternalSearch(e.target.value)} icon={Search} className="flex-1" />
                    </div>

                    {/* Full Table */}
                    <div className="rounded-xl overflow-hidden">
                      <DataTable
                        columns={[
                          {
                            header: 'Sel',
                            render: (row) => {
                              const isExcluded = excludedEmails.includes(row.email);
                              return (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isExcluded) setExcludedEmails(prev => prev.filter(e => e !== row.email));
                                    else setExcludedEmails(prev => [...prev, row.email]);
                                  }}
                                  className={`w-4 h-4 rounded flex items-center justify-center border cursor-pointer ${!isExcluded ? 'bg-[var(--color-action-primary)] border-[var(--color-action-primary)] text-white' : 'border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]'}`}
                                >
                                  {!isExcluded && <Check size={12} />}
                                </div>
                              );
                            }
                          },
                          { header: 'Name', key: 'name', render: (row) => <span className="text-xs font-bold">{row.name || '—'}</span> },
                          { header: 'Email', key: 'email', render: (row) => <span className="font-mono text-[10px] text-[var(--color-text-muted)]">{row.email}</span> },
                          { header: 'Source', render: (row) => <Badge variant="slate" className="text-[9px]">{row.source}</Badge> }
                        ]}
                        data={csvRecipients.filter(r => !excludedSources.includes(r.source)).filter(r => {
                          if (!externalSearch) return true;
                          return (r.name?.toLowerCase().includes(externalSearch.toLowerCase()) || r.email?.toLowerCase().includes(externalSearch.toLowerCase()));
                        })}
                        defaultPageSize={5}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* CRM Data Section */}
              <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--color-bg-border)] pb-3">
                  <span className="text-xs font-bold uppercase tracking-tight block">CRM Contacts</span>
                  <Button size="xs" variant="secondary" onClick={loadCrmContactsData} disabled={contactsLoading}>
                    <RefreshCw size={12} className={contactsLoading ? 'animate-spin' : ''} /> {contactsLoading ? 'Loading...' : 'Fetch CRM'}
                  </Button>
                </div>
                {allContacts.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 flex-wrap bg-[var(--color-bg-primary)] p-3 rounded-xl border border-[var(--color-bg-border)]">
                      <TabSwitcher activeTab={activeTab} onChange={setActiveTab} tabs={[{ id: 'all', label: 'All' }, { id: 'fresh', label: 'Fresh' }, { id: 'contacted', label: 'In Progress' }]} />
                      <div className="flex-1 min-w-[200px]">
                        <Input placeholder="Search Name or Email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} icon={Search} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="xs" variant="secondary" onClick={() => {
                          const filteredIds = filteredContacts.map(l => l._id);
                          const newSelected = Array.from(new Set([...selectedLeadIds, ...filteredIds]));
                          setSelectedLeadIds(newSelected);
                        }}>Select Filtered ({filteredContacts.length})</Button>
                        <Button size="xs" variant="ghost" onClick={() => setSelectedLeadIds([])} className="text-rose-500 hover:bg-rose-500/10">Clear</Button>
                      </div>
                    </div>
                    <div className="rounded-xl overflow-hidden">
                      <DataTable
                        columns={[
                          {
                            header: 'Sel',
                            render: (row) => {
                              const isSel = selectedLeadIds.includes(row._id);
                              return (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isSel) setSelectedLeadIds(prev => prev.filter(id => id !== row._id));
                                    else setSelectedLeadIds(prev => [...prev, row._id]);
                                  }}
                                  className={`w-4 h-4 rounded flex items-center justify-center border cursor-pointer ${isSel ? 'bg-[var(--color-action-primary)] border-[var(--color-action-primary)] text-white' : 'border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]'}`}
                                >
                                  {isSel && <Check size={12} />}
                                </div>
                              );
                            }
                          },
                          { header: 'Name', key: 'name', render: (row) => <span className="text-xs font-bold">{row.name || '—'}</span> },
                          { header: 'Email', key: 'email', render: (row) => <span className="font-mono text-[10px] text-[var(--color-text-muted)]">{row.email}</span> },
                          { header: 'Status', render: (row) => <Badge variant="slate" className="text-[9px]">{row.leadStatus || 'Fresh'}</Badge> }
                        ]}
                        data={filteredContacts}
                        defaultPageSize={5}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Exly Data Section */}
              <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--color-bg-border)] pb-3">
                  <span className="text-xs font-bold uppercase tracking-tight block">Exly Contacts</span>
                  <Button size="xs" variant="secondary" onClick={loadExlyContactsData} disabled={exlyContactsLoading}>
                    <RefreshCw size={12} className={exlyContactsLoading ? 'animate-spin' : ''} /> {exlyContactsLoading ? 'Loading...' : 'Fetch Exly'}
                  </Button>
                </div>
                {allExlyContacts.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 flex-wrap bg-[var(--color-bg-primary)] p-3 rounded-xl border border-[var(--color-bg-border)]">
                      <select
                        value={filters.exlyOffering}
                        onChange={e => setFilters(prev => ({ ...prev, exlyOffering: e.target.value }))}
                        className="px-3 py-1.5 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-lg text-xs font-bold outline-none text-[var(--color-text-primary)]"
                      >
                        <option value="all">All Exly Offerings</option>
                        {exlyOfferingsList.map(offering => (
                          <option key={offering} value={offering}>{offering}</option>
                        ))}
                      </select>
                      <div className="flex-1 min-w-[200px]">
                        <Input placeholder="Search Name or Email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} icon={Search} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="xs" variant="secondary" onClick={() => {
                          const filteredIds = filteredExlyContacts.map(l => l._id);
                          const newSelected = Array.from(new Set([...selectedLeadIds, ...filteredIds]));
                          setSelectedLeadIds(newSelected);
                        }}>Select Filtered ({filteredExlyContacts.length})</Button>
                        <Button size="xs" variant="ghost" onClick={() => setSelectedLeadIds([])} className="text-rose-500 hover:bg-rose-500/10">Clear</Button>
                      </div>
                    </div>
                    <div className="rounded-xl overflow-hidden">
                      <DataTable
                        columns={[
                          {
                            header: 'Sel',
                            render: (row) => {
                              const isSel = selectedLeadIds.includes(row._id);
                              return (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isSel) setSelectedLeadIds(prev => prev.filter(id => id !== row._id));
                                    else setSelectedLeadIds(prev => [...prev, row._id]);
                                  }}
                                  className={`w-4 h-4 rounded flex items-center justify-center border cursor-pointer ${isSel ? 'bg-[var(--color-action-primary)] border-[var(--color-action-primary)] text-white' : 'border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]'}`}
                                >
                                  {isSel && <Check size={12} />}
                                </div>
                              );
                            }
                          },
                          { header: 'Name', key: 'name', render: (row) => <span className="text-xs font-bold">{row.name || '—'}</span> },
                          { header: 'Email', key: 'email', render: (row) => <span className="font-mono text-[10px] text-[var(--color-text-muted)]">{row.email}</span> },
                          { header: 'Status', render: (row) => <Badge variant="slate" className="text-[9px]">{row.leadStatus || 'Fresh'}</Badge> },
                          {
                            header: 'Exly Offering', render: (row) => {
                              let offerings = '';
                              if (Array.isArray(row.exlyOfferings)) {
                                offerings = row.exlyOfferings
                                  .map(o => typeof o === 'string' ? o : o?.title || o?.offeringId || 'Unknown')
                                  .filter(Boolean)
                                  .join(', ');
                              } else {
                                offerings = row.exlyOfferingTitle || '';
                              }
                              return offerings ? <Badge variant="info" className="text-[9px]">{offerings}</Badge> : <span className="text-[10px] text-[var(--color-text-muted)]">—</span>;
                            }
                          }
                        ]}
                        data={filteredExlyContacts}
                        defaultPageSize={5}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {campaignStep === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between gap-4">
                <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-3">
                  <input 
                    type="checkbox"
                    checked={useRawHtml}
                    onChange={(e) => {
                      setUseRawHtml(e.target.checked);
                      setIsCustomHtml(e.target.checked);
                    }}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                  Raw HTML Mode
                </label>
                <div className="flex items-center gap-2">
                  <Button size="xs" variant="secondary" onClick={() => setShowPreviewModal(true)}>
                    <Eye size={12} /> Preview
                  </Button>
                  {!useRawHtml && (
                    <>
                      <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-lg text-[10px] font-black uppercase hover:border-[var(--color-action-primary)] transition-all">
                        <Upload size={12} /> {htmlFileName ? htmlFileName : 'Upload HTML File'}
                        <input type="file" accept=".html,.htm" className="hidden" onChange={handleHtmlUpload} />
                      </label>
                      <Button 
                        size="xs" 
                        variant="secondary"
                        onClick={() => setShowHtmlPasteModal(true)}
                      >
                        <Upload size={12} /> Paste HTML
                      </Button>
                    </>
                  )}
                  <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-lg text-[10px] font-black uppercase hover:border-[var(--color-action-primary)] transition-all">
                    <Upload size={12} /> Attachments ({attachments.length})
                    <input type="file" multiple className="hidden" onChange={handleAttachmentUpload} />
                  </label>
                  {templates.length > 0 && !useRawHtml && (
                    <select
                      className="bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] text-[var(--color-text-primary)] rounded-lg px-3 py-1 text-[10px] font-black uppercase outline-none"
                      onChange={(e) => {
                        const t = templates.find(temp => temp._id === e.target.value);
                        if (t) {
                          setContent(t.content);
                          e.target.value = '';
                        }
                      }}
                    >
                      <option value="">Load Template...</option>
                      {templates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                    </select>
                  )}
                  <Button size="xs" variant="primary" onClick={() => {
                    const name = window.prompt('Enter a name for this template:');
                    if (name) {
                      saveTemplateMutation.mutate({ name, content });
                      alert('Template Saved!');
                    }
                  }}>
                    <Save size={12} /> Save
                  </Button>
                </div>
              </div>

              {useRawHtml ? (
                <>
                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-600 font-bold">
                    ℹ️ Raw HTML Mode Active - Paste your HTML code to see a live preview below
                  </div>
                  <Button 
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowHtmlPasteModal(true)}
                    className="w-full"
                  >
                    <Upload size={14} /> Paste HTML Code
                  </Button>
                  {content && (
                    <div className="border border-[var(--color-bg-border)] rounded-xl overflow-hidden">
                      <div className="bg-[var(--color-bg-secondary)] px-3 py-2 flex gap-2">
                        <button
                          onClick={() => setPreviewMode('desktop')}
                          className={`px-3 py-1 rounded text-[10px] font-bold ${previewMode === 'desktop' ? 'bg-[var(--color-action-primary)] text-white' : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]'}`}
                        >
                          Desktop
                        </button>
                        <button
                          onClick={() => setPreviewMode('mobile')}
                          className={`px-3 py-1 rounded text-[10px] font-bold ${previewMode === 'mobile' ? 'bg-[var(--color-action-primary)] text-white' : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]'}`}
                        >
                          Mobile
                        </button>
                      </div>
                      <div className={`bg-white overflow-auto ${previewMode === 'mobile' ? 'max-w-md mx-auto' : ''}`} style={{ height: '400px' }}>
                        <iframe
                          srcDoc={content}
                          className="w-full h-full border-none"
                          title="Email Preview"
                          sandbox="allow-same-origin"
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Variable Detection Warning */}
                  {content.includes('{{') && (
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
                      <AlertCircle size={16} className="text-yellow-500 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-yellow-600 flex-1">
                        <p className="font-bold mb-1">Variables Detected</p>
                        <p>Add fallback values for: {(content.match(/\{\{\w+\}\}/g) || []).join(', ')}</p>
                        <p className="mt-2 font-mono text-[10px]">Format: {"{{variable_name}}"} or {"{{variable_name|fallback_value}}"}</p>
                      </div>
                    </div>
                  )}

                  <div className="bg-white text-black rounded-lg overflow-hidden border border-[var(--color-bg-border)]">
                    <ReactQuill theme="snow" value={content} onChange={setContent} className="h-[400px] mb-12" />
                  </div>
                </>
              )}
              
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] px-3 py-1.5 rounded-lg text-[11px] font-mono">
                      <span>{att.filename}</span>
                      <button type="button" className="text-rose-500 hover:text-rose-400" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 mt-4 text-xs">
                <input
                  type="checkbox"
                  id="removeUnsubscribe"
                  checked={removeUnsubscribe}
                  onChange={(e) => setRemoveUnsubscribe(e.target.checked)}
                  className="rounded border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] text-[var(--color-action-primary)] focus:ring-[var(--color-action-primary)]"
                />
                <label htmlFor="removeUnsubscribe" className="cursor-pointer">Remove Unsubscribe Footer (Not Recommended)</label>
              </div>

              <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Test Campaign</label>
                  <span className="text-[9px] text-[var(--color-text-muted)]">Send preview to test email</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input 
                    type="email"
                    placeholder="Test email address"
                    value={testCampaignEmail}
                    onChange={e => setTestCampaignEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    size="sm" 
                    variant="secondary"
                    onClick={async () => {
                      if (!testCampaignEmail) {
                        alert('Enter test email');
                        return;
                      }
                      try {
                        await axios.post('/api/mail/test-campaign', {
                          subject,
                          content,
                          testEmail: testCampaignEmail,
                          senderProfileId
                        });
                        alert(`Test email sent to ${testCampaignEmail}`);
                      } catch (e) {
                        alert('Failed to send test: ' + (e.response?.data?.error || e.message));
                      }
                    }}
                  >
                    <Send size={12} /> Send Test
                  </Button>
                </div>
              </div>
            </div>
          )}

          {campaignStep === 4 && (
            <div className="space-y-6 animate-in fade-in">
              <h4 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
                <CheckCircle2 size={14} /> Review & Send
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm font-mono">
                <div className="p-4 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-bg-border)]">
                  <span className="text-[10px] uppercase text-[var(--color-text-muted)] block mb-1">Campaign Title</span>
                  {title || '—'}
                </div>
                <div className="p-4 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-bg-border)]">
                  <span className="text-[10px] uppercase text-[var(--color-text-muted)] block mb-1">Subject</span>
                  {subject || '—'}
                </div>
                <div className="p-4 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-bg-border)]">
                  <span className="text-[10px] uppercase text-[var(--color-text-muted)] block mb-1">Total Recipients</span>
                  {selectedLeadIds.length + activeCsvRecipients.length}
                </div>
                <div className="p-4 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-bg-border)]">
                  <span className="text-[10px] uppercase text-[var(--color-text-muted)] block mb-1">Attachments</span>
                  {attachments.length} files
                </div>
              </div>
              <div className="p-4 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-bg-border)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase text-[var(--color-text-muted)] block">
                    {isRawHtmlPreview ? 'Content Preview (Raw HTML)' : 'Content Preview'}
                  </span>
                  <Button size="xs" variant="secondary" onClick={() => setShowPreviewModal(true)}>
                    <Eye size={12} /> Visual Preview
                  </Button>
                </div>
                {isRawHtmlPreview ? (
                  <div className="border border-[var(--color-bg-border)] rounded-lg overflow-hidden bg-white" style={{ height: '320px' }}>
                    <iframe
                      srcDoc={content}
                      className="w-full h-full border-none"
                      title="Email Preview"
                      sandbox="allow-same-origin"
                    />
                  </div>
                ) : (
                  <div className="text-[10px] text-[var(--color-text-secondary)] whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {content.substring(0, 500)}{content.length > 500 ? '...' : ''}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t border-[var(--color-bg-border)]">
            <Button variant="ghost" onClick={() => {
              if (campaignStep === 1) setMode('campaigns');
              else setCampaignStep(campaignStep - 1);
            }}>
              {campaignStep === 1 ? 'Cancel' : 'Back'}
            </Button>

            {campaignStep < 4 ? (
              <Button onClick={() => setCampaignStep(campaignStep + 1)}>
                Next Step
              </Button>
            ) : (
              <Button
                onClick={() => {
                  handleCreateCampaign();
                  setCampaignStep(1);
                  setIsCustomHtml(false);
                }}
                disabled={createCampaignMutation.isPending || (!title || !subject || !content || !senderProfileId || (selectedLeadIds.length === 0 && activeCsvRecipients.length === 0))}
              >
                <Play size={14} /> Save & Create Campaign
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Mode: SMTP Profiles */}
      {mode === 'profiles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 space-y-4 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-action-primary)] flex items-center gap-2">
                <Zap size={16} /> {editingProfileId ? 'Edit SMTP Profile' : 'Configure SMTP Profile'}
              </h3>
              {editingProfileId && (
                <Button size="xs" variant="ghost" onClick={() => { setEditingProfileId(null); setNewProfile({ name: '', email: '', smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '', signature: defaultSignatureTemplate }); }}>
                  Cancel Edit
                </Button>
              )}
            </div>
            <form onSubmit={handleCreateProfile} className="space-y-4">
              <Input label="Profile Name" placeholder="e.g. Master Dispatch" value={newProfile.name} onChange={e => setNewProfile({ ...newProfile, name: e.target.value })} />
              <Input label="Sender Email Address" placeholder="e.g. notifications@company.com" value={newProfile.email} onChange={e => setNewProfile({ ...newProfile, email: e.target.value })} />
              <Input label="SMTP Host" placeholder="e.g. smtp.sendgrid.net" value={newProfile.smtpHost} onChange={e => setNewProfile({ ...newProfile, smtpHost: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="SMTP Port" type="number" value={newProfile.smtpPort} onChange={e => setNewProfile({ ...newProfile, smtpPort: parseInt(e.target.value) })} />
                <Input label="Email" value={newProfile.smtpUser} onChange={e => setNewProfile({ ...newProfile, smtpUser: e.target.value })} />
              </div>
              <Input label="Gmail App Password" type="password" value={newProfile.smtpPass} onChange={e => setNewProfile({ ...newProfile, smtpPass: e.target.value })} />
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">Default HTML Signature</label>
                <textarea
                  className="w-full h-32 px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-xl text-xs font-mono outline-none"
                  placeholder="Enter HTML Signature template here..."
                  value={newProfile.signature}
                  onChange={e => setNewProfile({ ...newProfile, signature: e.target.value })}
                />
              </div>
              <Button type="submit" disabled={createProfileMutation.isPending || updateProfileMutation.isPending} className="w-full">
                <Plus size={14} /> {editingProfileId ? 'Update Profile' : 'Save SMTP Profile'}
              </Button>
            </form>
          </Card>

          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)]">Active Configurations ({profiles.length})</h3>
            {profiles.map(p => (
              <Card key={p._id} className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] flex items-center justify-between">
                <div>
                  <span className="font-bold uppercase tracking-tight text-xs block">{p.name}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{p.email} • {p.smtpHost}:{p.smtpPort}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-amber-500 hover:bg-amber-500/10"
                    onClick={() => {
                      setEditingProfileId(p._id);
                      setNewProfile({ name: p.name, email: p.email, smtpHost: p.smtpHost, smtpPort: p.smtpPort, smtpUser: p.smtpUser, smtpPass: '', signature: p.signature || '' });
                    }}
                  >
                    <Edit size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose-500 hover:bg-rose-500/10"
                    onClick={() => deleteProfileMutation.mutate(p._id)}
                    disabled={deleteProfileMutation.isPending}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </Card>
            ))}
            {profiles.length === 0 && (
              <div className="p-12 text-center opacity-30 border border-dashed border-[var(--color-bg-border)] rounded-2xl">
                <Zap size={32} className="mx-auto mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">No profiles configured</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode: Templates */}
      {mode === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 space-y-4 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-action-primary)] flex items-center gap-2">
                <FileCode size={16} /> Manage Saved Templates
              </h3>
            </div>

            <div className="space-y-3">
              {templates.map(t => (
                <Card key={t._id} className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs tracking-tight block">{t.name}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase">Created: {format(new Date(t.createdAt), 'MMM dd')}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setMode('new_campaign');
                        setContent(t.content);
                        setCampaignStep(3);
                      }}
                    >
                      <Play size={14} /> Use Template
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-500 hover:bg-rose-500/10"
                      onClick={() => {
                        if (window.confirm('Delete this template?')) {
                          deleteTemplateMutation.mutate(t._id);
                        }
                      }}
                      disabled={deleteTemplateMutation.isPending}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </Card>
              ))}
              {templates.length === 0 && (
                <div className="p-12 text-center opacity-30 border border-dashed border-[var(--color-bg-border)] rounded-2xl">
                  <FileCode size={32} className="mx-auto mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-widest">No Templates Saved</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Mode: CSV Import */}
      {mode === 'csv_import' && (
        <CsvImporter onImportComplete={() => { alert('Import complete!'); queryClient.invalidateQueries({ queryKey: ['leads'] }); }} />
      )}

      {/* Mode: Cumulative Analytics */}
      {mode === 'analytics' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <Card className="p-6 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
              <BarChart2 size={14} /> Cumulative Campaign Performance (By Event Tag)
            </h3>
            <div className="border border-[var(--color-bg-border)] rounded-xl overflow-x-auto bg-[var(--color-bg-secondary)] custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs font-mono whitespace-nowrap">
                <thead className="bg-[var(--color-bg-primary)] border-b border-[var(--color-bg-border)]">
                  <tr>
                    <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-[10px] uppercase">Event Tag</th>
                    <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-[10px] uppercase">Total Sent</th>
                    <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-[10px] uppercase">Total Opens</th>
                    <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-[10px] uppercase">Total Clicks</th>
                    <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-[10px] uppercase">Open Rate</th>
                    <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-[10px] uppercase">CTR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-bg-border)]">
                  {(cumulativeAnalytics?.aggregateData || []).map((row, idx) => (
                    <tr key={idx} className="hover:bg-[var(--color-bg-primary)]/50">
                      <td className="px-4 py-3 font-bold text-[var(--color-action-primary)]">{row.eventTag}</td>
                      <td className="px-4 py-3">{row.totalSent}</td>
                      <td className="px-4 py-3">{row.totalOpens}</td>
                      <td className="px-4 py-3">{row.totalClicks}</td>
                      <td className="px-4 py-3"><Badge variant="mint">{row.openRate}%</Badge></td>
                      <td className="px-4 py-3"><Badge variant="info">{row.ctr}%</Badge></td>
                    </tr>
                  ))}
                  {(!cumulativeAnalytics?.aggregateData || cumulativeAnalytics.aggregateData.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-muted)] italic font-mono">No cumulative campaign analytics recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-6 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
              <Users size={14} /> Engaged Lead Distribution (By Location)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(cumulativeAnalytics?.dynamicBreakdown || []).map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-xl flex items-center justify-between cursor-pointer hover:bg-[var(--color-bg-border)]/20 transition-all duration-200"
                  onClick={() => setSelectedLocationForModal(item.location)}
                >
                  <span className="font-bold text-xs block">{item.location}</span>
                  <Badge variant="mint">{item.count} Engaged</Badge>
                </div>
              ))}
              {(!cumulativeAnalytics?.dynamicBreakdown || cumulativeAnalytics.dynamicBreakdown.length === 0) && (
                <div className="col-span-3 p-8 text-center text-[var(--color-text-muted)] italic font-mono border border-dashed rounded-xl">No engaged lead demographics recorded yet.</div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Selected Campaign Detail Modal */}
      {selectedCampaign && (
        <div className="tm-modal-overlay fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm p-4">
          <div className="tm-modal-panel max-w-5xl max-h-[90vh] bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-2xl flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200" role="dialog" aria-modal="true">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[var(--color-bg-secondary)] border-b border-[var(--color-bg-border)] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-black uppercase tracking-tight">{selectedCampaign.title}</h2>
                  <Badge variant={selectedCampaign.status === 'Completed' ? 'mint' : selectedCampaign.status === 'Sending' ? 'warning' : 'info'}>
                    {selectedCampaign.status}
                  </Badge>
                </div>
                <p className="text-xs font-mono text-[var(--color-text-muted)] mt-1">{selectedCampaign.subject}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-500 hover:bg-rose-500/10"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this campaign? All associated metrics and tracking data will be permanently removed.')) {
                      deleteCampaignMutation.mutate(selectedCampaign._id, {
                        onSuccess: () => {
                          setSelectedCampaign(null);
                          window.location.reload();
                        }
                      });
                    }
                  }}
                  disabled={deleteCampaignMutation.isPending}
                  title="Delete Campaign & Data"
                >
                  <Trash2 size={16} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedCampaign(null)}>
                  <X size={18} />
                </Button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <StatCard label="Total Target" value={selectedCampaign.stats?.total || 0} icon={Users} variant="slate" />
                <StatCard label="Sent Success" value={selectedCampaign.stats?.sent || 0} icon={Send} variant="mint" />
                <StatCard label="Opened" value={selectedCampaign.stats?.opened || 0} icon={CheckCircle2} variant="info" />
                <StatCard label="Clicked" value={selectedCampaign.stats?.clicked || 0} icon={Play} variant="apricot" />
                <StatCard label="Bounced / Fail" value={selectedCampaign.stats?.bounced || 0} icon={AlertCircle} variant="rose" />
                <StatCard
                  label="User Unsub"
                  value={selectedCampaign.stats?.unsubscribed || 0}
                  icon={UserMinus}
                  variant="warning"
                  onClick={() => window.open('https://docs.google.com/spreadsheets/d/1BuHfbhY21cFoSHaanH8Q5Rg_80s3zHZY9snwzCroRe0/edit?usp=sharing', '_blank')}
                />
              </div>

              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--color-text-secondary)] mb-3 flex items-center gap-2">
                  <Users size={14} /> Campaign Recipient Analytics ({selectedCampaign.recipients?.length || 0})
                </h3>
                <div className="border border-[var(--color-bg-border)] rounded-xl overflow-hidden bg-[var(--color-bg-secondary)]">
                  <table className="w-full text-left border-collapse text-xs font-mono whitespace-nowrap">
                    <thead className="bg-[var(--color-bg-primary)] border-b border-[var(--color-bg-border)]">
                      <tr>
                        <th className="px-4 py-2.5 font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Recipient Email</th>
                        <th className="px-4 py-2.5 font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Status</th>
                        <th className="px-4 py-2.5 font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Sent At</th>
                        <th className="px-4 py-2.5 font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Diagnostic Info</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-bg-border)] font-mono">
                      {selectedCampaign.recipients?.map((r, idx) => (
                        <tr key={r._id || idx} className="hover:bg-[var(--color-bg-primary)]/50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-[var(--color-text-primary)]">{r.email}</td>
                          <td className="px-4 py-3">
                            <Badge variant={r.status === 'Opened' ? 'mint' : r.status === 'Sent' ? 'info' : r.status === 'Unsubscribed' ? 'warning' : r.status === 'Bounced' || r.status === 'Failed' || r.status === 'Invalid' ? 'rose' : 'slate'}>
                              {r.status || 'Pending'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-[11px] text-[var(--color-text-muted)]">
                            {r.sentAt ? format(new Date(r.sentAt), 'MMM dd, HH:mm:ss') : '—'}
                          </td>
                          <td className="px-4 py-3 text-[11px] text-[var(--color-text-muted)] truncate max-w-xs">
                            {r.error || r.messageId || 'Normal Target Dispatch'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedLocationForModal && (
        <LocationLeadsModal
          location={selectedLocationForModal}
          onClose={() => setSelectedLocationForModal(null)}
        />
      )}

      {/* HTML Paste Modal - Full Screen */}
      {showHtmlPasteModal && (
        <div className="tm-modal-overlay fixed inset-0 z-[1001] bg-black/60 backdrop-blur-sm p-0">
          <div className="bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] w-full h-full flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[var(--color-bg-secondary)] border-b border-[var(--color-bg-border)] flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-black uppercase tracking-tight">Paste HTML Email</h2>
              <Button variant="ghost" size="sm" onClick={() => {
                setShowHtmlPasteModal(false);
                setHtmlPasteText('');
              }}>
                <X size={16} />
              </Button>
            </div>

            {/* Modal Body */}
            <div className="flex flex-1 overflow-hidden gap-4 p-6">
              {/* Textarea for HTML */}
              <div className="flex-1 flex flex-col">
                <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Paste HTML</label>
                <textarea
                  value={htmlPasteText}
                  onChange={(e) => setHtmlPasteText(e.target.value)}
                  className="flex-1 p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Paste your HTML email template here..."
                />
              </div>

              {/* Live Preview with Desktop/Mobile Toggle */}
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Preview</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPreviewMode('desktop')}
                      className={`px-3 py-1 rounded text-[9px] font-bold ${previewMode === 'desktop' ? 'bg-[var(--color-action-primary)] text-white' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'}`}
                    >
                      Desktop
                    </button>
                    <button
                      onClick={() => setPreviewMode('mobile')}
                      className={`px-3 py-1 rounded text-[9px] font-bold ${previewMode === 'mobile' ? 'bg-[var(--color-action-primary)] text-white' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'}`}
                    >
                      Mobile
                    </button>
                  </div>
                </div>
                <div className={`flex-1 border border-[var(--color-bg-border)] rounded-xl overflow-auto bg-white ${previewMode === 'mobile' ? 'max-w-sm' : ''}`}>
                  {htmlPasteText.trim() ? (
                    <iframe
                      srcDoc={htmlPasteText}
                      className="w-full h-full border-none"
                      title="Email Preview"
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--color-text-muted)]">
                      <span className="text-sm">Paste HTML to preview</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-[var(--color-bg-secondary)] border-t border-[var(--color-bg-border)] flex items-center justify-end gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowHtmlPasteModal(false);
                  setHtmlPasteText('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (htmlPasteText.trim()) {
                    setContent(htmlPasteText);
                    setHtmlFileName('pasted-content.html');
                    setIsCustomHtml(true);
                    setShowHtmlPasteModal(false);
                    setHtmlPasteText('');
                  }
                }}
                disabled={!htmlPasteText.trim()}
              >
                <CheckCircle2 size={14} /> Use This HTML
              </Button>
            </div>
          </div>
        </div>
      )}

      {selectedLocationForModal && (
        <LocationLeadsModal
          location={selectedLocationForModal}
          onClose={() => setSelectedLocationForModal(null)}
        />
      )}

      {showPreviewModal && (
        <div className="tm-modal-overlay fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm p-4">
          <div className="tm-modal-panel max-w-4xl max-h-[90vh] bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-2xl flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200" role="dialog" aria-modal="true">
            <div className="px-6 py-4 bg-[var(--color-bg-secondary)] border-b border-[var(--color-bg-border)] flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight">Email Preview</h2>
                <p className="text-xs font-mono text-[var(--color-text-muted)] mt-1">
                  {subject || 'No Subject Provided'}
                </p>
                {isRawHtmlPreview && (
                  <p className="text-[10px] text-emerald-600 font-bold mt-1">
                    Raw HTML — matches what will be sent
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewMode('desktop')}
                  className={`px-3 py-1 rounded text-[10px] font-bold ${previewMode === 'desktop' ? 'bg-[var(--color-action-primary)] text-white' : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]'}`}
                >
                  Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('mobile')}
                  className={`px-3 py-1 rounded text-[10px] font-bold ${previewMode === 'mobile' ? 'bg-[var(--color-action-primary)] text-white' : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]'}`}
                >
                  Mobile
                </button>
                <Button variant="ghost" size="sm" onClick={() => setShowPreviewModal(false)}>
                  <X size={16} />
                </Button>
              </div>
            </div>
            <div className={`flex-1 overflow-auto bg-white min-h-[400px] ${previewMode === 'mobile' ? 'max-w-md mx-auto' : ''}`}>
              <iframe
                srcDoc={emailPreviewSrcDoc}
                className="w-full h-full min-h-[400px] border-none"
                title="Email Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}


    </div>
  );
}

function LocationLeadsModal({ location, onClose }) {
  const { data: leads = [], isLoading } = useLocationLeads(location, true);

  return (
    <div className="tm-modal-overlay fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm p-4">
      <div className="tm-modal-panel max-w-3xl max-h-[80vh] bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-2xl flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200" role="dialog" aria-modal="true">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[var(--color-bg-secondary)] border-b border-[var(--color-bg-border)] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight">Leads in {location}</h2>
            <p className="text-xs font-mono text-[var(--color-text-muted)] mt-1">Showing engaged/active leads registered at this location</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[var(--color-bg-primary)]">
          {isLoading ? (
            <div className="py-8 text-center text-xs font-mono text-[var(--color-text-muted)] animate-pulse">Loading leads...</div>
          ) : leads.length === 0 ? (
            <div className="py-8 text-center text-xs font-mono text-[var(--color-text-muted)] italic">No engaged leads found for this location.</div>
          ) : (
            <div className="border border-[var(--color-bg-border)] rounded-xl overflow-hidden bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]">
              <table className="w-full text-left border-collapse text-xs font-mono whitespace-nowrap">
                <thead className="bg-[var(--color-bg-primary)] border-b border-[var(--color-bg-border)] text-[var(--color-text-muted)] uppercase tracking-wider font-bold">
                  <tr>
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Email</th>
                    <th className="px-4 py-2.5">Phone</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-bg-border)] font-mono">
                  {leads.map((lead, idx) => (
                    <tr key={lead._id || idx} className="hover:bg-[var(--color-bg-primary)]/50 transition-colors">
                      <td className="px-4 py-3 font-semibold">{lead.name || 'N/A'}</td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{lead.email}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">{lead.phone || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={lead.unsubscribed ? 'warning' : lead.emailStatus === 'Bounced' ? 'danger' : 'success'}>
                          {lead.unsubscribed ? 'Unsubscribed' : lead.emailStatus || 'Active'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
