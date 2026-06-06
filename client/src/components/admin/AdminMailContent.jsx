import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Mail, Plus, Play, FileCode, Trash2, Zap, BarChart2, RefreshCw, Newspaper,
} from 'lucide-react';
import { Card, Button, Badge, DataTable, PageSkeleton } from '../ui';
import {
  useMailProfiles, useMailCampaigns, useMailStats,
  useSendCampaign, useDeleteCampaign, useScanBounces, useCumulativeAnalytics,
  useMailTemplates,
} from '../../hooks/useTaskmasterQueries';
import MailTemplateStudio from './MailTemplateStudio';
import MailCampaignWizard from './MailCampaignWizard';
import MailLocationLeadsModal from './MailLocationLeadsModal';
import MailCumulativeAnalyticsPanel from './MailCumulativeAnalyticsPanel';
import MailStatsSummary from './MailStatsSummary';
import MailProfilesPanel from './MailProfilesPanel';
import CsvImporter from '../CsvImporter';
import { format } from 'date-fns';
import { useConfirm } from '../../contexts/confirmContext';
import { useToast } from '../../contexts/ToastContext';


export default function AdminMailContent({ initialMode = null, hideModeBar = false, standaloneWizard = false } = {}) {
  const { confirm } = useConfirm();
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState(initialMode || 'campaigns');
  const [wizardSeed, setWizardSeed] = useState(null);
  const { data: profiles = [], isLoading: profilesLoading } = useMailProfiles();
  const { data: campaigns = [], isLoading: campaignsLoading } = useMailCampaigns();
  const { data: stats } = useMailStats();
  const { data: cumulativeAnalytics } = useCumulativeAnalytics(mode === 'analytics');

  const sendCampaignMutation = useSendCampaign();
  const deleteCampaignMutation = useDeleteCampaign();
  const scanBouncesMutation = useScanBounces();

  const [selectedLocationForModal, setSelectedLocationForModal] = useState(null);

  const { data: approvedTemplates = [] } = useMailTemplates('approved');
  const { data: templateLibrary = [] } = useMailTemplates();

  const [isCustomHtml, setIsCustomHtml] = useState(false);
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
    footerText: 'The Shakti Collective â€¢ indigenously rooted music',
    feature1Title: 'Advanced routing pipelines',
    feature1Text: 'Sales rep assignment metrics are now protected under isolated MongoDB transactions to eliminate duplicate allocations.',
    feature2Title: 'Dynamic geolocation metrics',
    feature2Text: 'We now track exact client locations on email open and click events to provide complete geographical breakdown analytics.'
  });

  const defaultReminderHTML = (params) => {
    const { logoText = 'The Shakti Collective', dateText = 'Tomorrow @ 4:00 PM IST', locationText = 'Main Shakti Hall', messageText = 'Your upcoming immersive musical alignment and production session is fast approaching. We are preparing our studio environment for an extraordinary session of creative transcendence.', ctaUrl = 'https://theshakticollective.in', ctaText = 'Access Collective Portal', bannerImg = '', footerText = 'The Shakti Collective â€¢ indigenously rooted music' } = params;
    const bannerImgTag = bannerImg
      ? `<tr>
          <td align="center" style="padding-bottom: 24px;">
            <img src="${bannerImg}" alt="Session Banner" style="width: 100%; max-height: 220px; object-fit: cover; border-radius: 6px; border: 1px solid #334155;" />
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
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 32px 28px;">
          <tr>
            <td align="center" style="padding-bottom: 24px; border-bottom: 1px solid #334155; margin-bottom: 24px;">
              <h1 style="font-size: 22px; font-weight: 700; color: #2dd4bf; margin: 0 0 8px 0; letter-spacing: 0.02em;">${logoText}</h1>
              <p style="font-size: 13px; font-weight: 600; color: #94a3b8; margin: 0; text-transform: uppercase; letter-spacing: 0.1em;">Exclusive Session Reminder</p>
            </td>
          </tr>
          ${bannerImgTag}
          <tr>
            <td style="padding: 24px 0 28px 0; font-size: 15px; line-height: 1.6; color: #cbd5e1;">
              <p style="margin: 0 0 20px 0;">Namaste <strong>Valued Member</strong>,</p>
              <p style="margin: 0 0 24px 0;">${messageText}</p>
              
              <div style="background-color: #334155; border: 1px solid #475569; border-left: 3px solid #10b981; padding: 16px 20px; border-radius: 6px; margin-bottom: 32px;">
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #94a3b8; text-transform: uppercase; font-weight: 600; letter-spacing: 0.06em;">Session Details</p>
                <p style="margin: 0 0 4px 0; font-size: 18px; font-weight: 600; color: #f8fafc;">Shakti Studio Alignment</p>
                <p style="margin: 0; font-size: 14px; color: #cbd5e1;">Date: ${dateText} | Location: ${locationText}</p>
              </div>

              <p style="margin: 0 0 36px 0; text-align: center;">Please confirm your attendance or review session prerequisites on our official collective portal.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 40px;">
              <a href="${ctaUrl}" style="display: inline-block; background: #126d5e; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 6px;">${ctaText}</a>
            </td>
          </tr>
          <tr>
            <td align="center" style="border-top:1px solid #334155;padding-top:20px;font-size:11px;color:#64748b;">
              <p style="margin:0;">The Shakti Collective â€¢ <a href="{{unsubscribe_url}}" style="color:#2dd4bf;text-decoration:none;">Unsubscribe</a></p>
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
            <img src="${bannerImg}" alt="Banner" style="width:100%;height:auto;display:block;border-bottom:1px solid #334155;" />
          </td>
        </tr>`
      : '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Exclusive Announcement</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#1e293b;border:1px solid #334155;border-radius:8px;overflow:hidden;">
          ${bannerImgTag}
          <tr>
            <td style="padding:32px 28px;">
              <h2 style="font-size:22px;font-weight:700;color:#2dd4bf;margin:0 0 16px 0;letter-spacing:0.02em;">${titleText}</h2>
              <p style="font-size:15px;line-height:1.6;color:#cbd5e1;margin:0 0 24px 0;">Hello {{name}},</p>
              <p style="font-size:15px;line-height:1.6;color:#cbd5e1;margin:0 0 24px 0;">${messageText}</p>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:28px 0;">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" style="display:inline-block;background:#126d5e;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:6px;">${ctaText}</a>
                  </td>
                </tr>
              </table>
              <p style="font-size:14px;line-height:1.6;color:#94a3b8;margin:0;text-align:center;">Have questions? Reply directly to this email or visit our Help Center.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="background-color:#0f172a;padding:20px;font-size:11px;color:#64748b;border-top:1px solid #334155;">
              <p style="margin:0 0 8px 0;">You are receiving this because you subscribed to our updates.</p>
              <p style="margin:0;"><a href="{{unsubscribe_url}}" style="color:#2dd4bf;text-decoration:none;">Unsubscribe</a></p>
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
    const { logoText = 'SHAKTI DIGEST', titleText = 'This Month at the Collective', messageText = "Welcome to this month's digest. We have been working hard to push boundary lines in music production, artist routing networks, and performance optimization.", feature1Title = 'Advanced routing pipelines', feature1Text = 'Sales rep assignment metrics are now protected under isolated MongoDB transactions to eliminate duplicate allocations.', feature2Title = 'Dynamic geolocation metrics', feature2Text = 'We now track exact client locations on email open and click events to provide complete geographical breakdown analytics.', ctaUrl = 'https://theshakticollective.in', ctaText = 'Read Full Blog', footerText = 'The Shakti Collective â€¢ indigenously rooted music' } = params;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Monthly Newsletter</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#1e293b;border:1px solid #334155;border-radius:8px;overflow:hidden;">
          <tr align="center" style="background-color:#1e293b;border-bottom:1px solid #334155;">
            <td align="center" style="padding: 28px 24px;">
              <h1 style="font-size:22px;font-weight:700;color:#2dd4bf;margin:0;text-transform:uppercase;letter-spacing:0.08em;">${logoText}</h1>
              <p style="font-size:11px;color:#94a3b8;margin:6px 0 0 0;text-transform:uppercase;letter-spacing:0.12em;">Monthly Newsletter & updates</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="font-size:13px;color:#94a3b8;margin:0 0 8px 0;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Update for {{name}}</p>
              <h2 style="font-size:20px;font-weight:700;color:#f8fafc;margin:0 0 16px 0;">${titleText}</h2>
              <p style="font-size:15px;line-height:1.6;color:#cbd5e1;margin:0 0 20px 0;">${messageText}</p>
              
              <h3 style="font-size:15px;color:#2dd4bf;margin:24px 0 8px 0;font-weight:600;">1. ${feature1Title}</h3>
              <p style="font-size:14px;line-height:1.6;color:#cbd5e1;margin:0 0 16px 0;">${feature1Text}</p>

              <h3 style="font-size:15px;color:#2dd4bf;margin:24px 0 8px 0;font-weight:600;">2. ${feature2Title}</h3>
              <p style="font-size:14px;line-height:1.6;color:#cbd5e1;margin:0 0 24px 0;">${feature2Text}</p>
              
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:24px 0;">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" style="display:inline-block;background:#126d5e;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:6px;">${ctaText}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="background-color:#0f172a;padding:20px;font-size:11px;color:#64748b;border-top:1px solid #334155;">
              <p style="margin:0 0 6px 0;">${footerText}</p>
              <p style="margin:0;"><a href="{{unsubscribe_url}}" style="color:#2dd4bf;text-decoration:none;">Unsubscribe</a></p>
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
<body style="font-family: monospace; font-size: 14px; line-height: 1.5; color: #cbd5e1; background-color: #0f172a; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border: 1px solid #334155; padding: 24px; border-radius: 8px;">
    <pre style="white-space: pre-wrap; font-family: inherit; margin: 0 0 24px 0;">${messageText}</pre>
    <div style="border-top: 1px solid #334155; padding-top: 12px; font-size: 11px; color: #64748b;">
      <a href="{{unsubscribe_url}}" style="color: #2dd4bf; text-decoration: underline;">Unsubscribe</a>
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
        <Badge variant={row.status === 'Completed' ? 'success' : row.status === 'Sending' ? 'warning' : row.status === 'Stopped' ? 'danger' : 'info'}>
          {row.status}
        </Badge>
      )
    },
    {
      header: 'Recipients & Delivery',
      render: (row) => (
        <div className="flex items-center gap-4">
          <div className="text-[11px] font-bold">
            {row.recipientCount ?? row.stats?.total ?? 0} Target
          </div>
          <div className="text-[11px] font-bold text-[var(--color-pastel-mint-text)]">
            {row.stats?.sent || 0} Sent
          </div>
        </div>
      )
    },
    {
      header: 'Created',
      render: (row) => (
        <div className="flex items-center justify-between gap-2 min-w-[10rem]">
          <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase">
            {format(new Date(row.createdAt), 'MMM dd, yyyy')}
          </span>
          <div
            className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {row.status === 'Draft' && (
              <Button
                size="xs"
                variant="primary"
                onClick={(e) => { e.stopPropagation(); sendCampaignMutation.mutate(row._id); }}
                disabled={sendCampaignMutation.isPending}
              >
                <Play size={12} /> Dispatch
              </Button>
            )}
            <Button
              size="xs"
              variant="ghost"
              className="text-[var(--color-pastel-rose-text)] hover:bg-[var(--color-pastel-rose-bg)]"
              onClick={async (e) => {
                e.stopPropagation();
                const ok = await confirm({
                  title: 'Delete campaign?',
                  message: 'Are you sure you want to delete this campaign? All associated metrics and tracking data will be permanently removed.',
                  confirmLabel: 'Delete',
                  type: 'danger',
                });
                if (!ok) return;
                deleteCampaignMutation.mutate(row._id, {
                  onSuccess: () => window.location.reload(),
                });
              }}
              disabled={deleteCampaignMutation.isPending}
              title="Delete Campaign & Data"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
      )
    }
  ];

  if (profilesLoading && campaignsLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      {/* Top Header & Mode Switcher */}
      {!hideModeBar && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between pb-4 border-b border-[var(--color-bg-border)]">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={mode === 'campaigns' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setMode('campaigns')}
            >
              <BarChart2 size={14} /> Campaigns ({campaigns.length})
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/emails/create')}
            >
              <Plus size={14} /> Create Campaign
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/emails/newsletter')}
            >
              <Newspaper size={14} /> Weekly Newsletter
            </Button>
            <Button
              variant={mode === 'templates' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setMode('templates')}
            >
              <FileCode size={14} /> Template Studio ({templateLibrary.length})
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

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              title="Scan the first SMTP profile inbox for bounce messages"
              onClick={() => {
                if (profiles.length === 0) {
                  toast.warn('Please configure an SMTP Profile first');
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
      )}

      {/* Analytics Summary */}
      {!hideModeBar && (
        <MailStatsSummary stats={stats} campaignCount={campaigns.length} />
      )}

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

      {(mode === 'new_campaign' || standaloneWizard) && (
        <MailCampaignWizard
          profiles={profiles}
          approvedTemplates={approvedTemplates}
          standaloneWizard={standaloneWizard}
          seed={wizardSeed}
          onExit={() => (standaloneWizard ? navigate('/emails') : setMode('campaigns'))}
          onOpenProfiles={() => setMode('profiles')}
          onOpenTemplates={() => setMode('templates')}
        />
      )}

      {/* Mode: SMTP Profiles */}
      {mode === 'profiles' && (
        <MailProfilesPanel profiles={profiles} />
      )}

      {/* Mode: Templates */}
      {mode === 'templates' && (
        <MailTemplateStudio
          onUseInCampaign={(t) => {
            setMode('new_campaign');
            setWizardSeed({ templateId: t._id, subject: t.subject || '', step: 3, token: Date.now() });
          }}
        />
      )}

      {/* Mode: CSV Import */}
      {mode === 'csv_import' && (
        <CsvImporter onImportComplete={() => { toast.success('Import complete!'); queryClient.invalidateQueries({ queryKey: ['leads'] }); }} />
      )}

      {/* Mode: Cumulative Analytics */}
      {mode === 'analytics' && (
        <MailCumulativeAnalyticsPanel
          cumulativeAnalytics={cumulativeAnalytics}
          onLocationSelect={setSelectedLocationForModal}
        />
      )}

      {selectedLocationForModal && (
        <MailLocationLeadsModal
          location={selectedLocationForModal}
          onClose={() => setSelectedLocationForModal(null)}
        />
      )}

    </div>
  );
}
