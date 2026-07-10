import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Send, Users, Database } from 'lucide-react';
import { Card, Button, Input, Badge, Switch } from '../ui';
import NexusDropdown from '../ui/NexusDropdown';
import { useMailProfiles } from '../../hooks/useTaskmasterQueries';
import {
  useNewsletterAudiencePreview,
  useSendNewsletterIssue,
  useCompileNewsletterIssue,
} from '../../hooks/queries/newsletter';
import { useToast } from '../../contexts/ToastContext';
import { NEWSLETTER_AUDIENCE_FOLDERS } from '../../utils/newsletterAudienceFolders';

const NewsletterSendWizard = ({ issue }) => {
  const toast = useToast();
  const navigate = useNavigate();
  const { data: profiles = [] } = useMailProfiles();
  const audiencePreviewMutation = useNewsletterAudiencePreview();
  const sendMutation = useSendNewsletterIssue();
  const compileMutation = useCompileNewsletterIssue();

  const [title, setTitle] = useState(`Shakti Digest — ${issue?.weekKey || ''}`);
  const [subject, setSubject] = useState(`Shakti Digest — ${issue?.weekKey || ''}`);
  const [senderProfileId, setSenderProfileId] = useState('');
  const [newsletterSubscribers, setNewsletterSubscribers] = useState(true);
  const [artistPath, setArtistPath] = useState(false);
  const [exlyOfferingIds, setExlyOfferingIds] = useState([]);
  const [dataHubFolders, setDataHubFolders] = useState([]);
  const [manualEmailsText, setManualEmailsText] = useState('');
  const [exlyOfferings, setExlyOfferings] = useState([]);
  const [audiencePreview, setAudiencePreview] = useState(null);

  useEffect(() => {
    if (profiles.length && !senderProfileId) {
      const def = profiles.find((p) => p.isDefault) || profiles[0];
      setSenderProfileId(def?._id || '');
    }
  }, [profiles, senderProfileId]);

  useEffect(() => {
    axios.get('/api/exly/offerings')
      .then((res) => {
        const rows = Array.isArray(res.data) ? res.data : res.data?.offerings || [];
        setExlyOfferings(rows);
        const artistPathDefaults = rows
          .filter((o) => /artist path/i.test(o.title || o.name || ''))
          .map((o) => o.offeringId || o._id)
          .filter(Boolean);
        if (artistPathDefaults.length) setExlyOfferingIds(artistPathDefaults);
      })
      .catch(() => {});
  }, []);

  const audience = useMemo(() => ({
    newsletterSubscribers,
    artistPath,
    exlyOfferingIds,
    dataHubFolders,
    manualEmails: manualEmailsText
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter(Boolean),
  }), [newsletterSubscribers, artistPath, exlyOfferingIds, dataHubFolders, manualEmailsText]);

  const profileOptions = profiles.map((p) => ({ value: p._id, label: `${p.name} <${p.email}>` }));
  const exlyOptions = exlyOfferings.map((o) => ({
    value: o.offeringId || o._id,
    label: o.title || o.name || o.offeringId,
  }));
  const folderOptions = NEWSLETTER_AUDIENCE_FOLDERS.map((f) => ({ value: f.key, label: f.label }));

  const refreshAudiencePreview = async () => {
    if (!issue?._id) return;
    try {
      const data = await audiencePreviewMutation.mutateAsync({ issueId: issue._id, audience });
      setAudiencePreview(data);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshAudiencePreview();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue?._id, audience]);

  const handleSend = async () => {
    if (!issue?._id) return;
    if (!senderProfileId) {
      toast.warn('Select a sender profile');
      return;
    }
    if (!audiencePreview?.recipients?.length) {
      toast.warn('No sendable recipients — adjust audience selection');
      return;
    }

    try {
      if (issue.status !== 'ready' && !issue.compiledHtml) {
        await compileMutation.mutateAsync(issue._id);
      }
      const result = await sendMutation.mutateAsync({
        issueId: issue._id,
        title,
        subject,
        senderProfileId,
        senderMode: 'single',
        includeSignature: true,
        audience,
      });
      toast.success(`Newsletter queued to ${result.audience?.recipients?.length || audiencePreview.recipients.length} recipients`);
      if (result.campaign?.campaignId || result.campaign?._id) {
        navigate(`/campaign/${result.campaign.campaignId || result.campaign._id}`, { state: { from: '/emails/newsletter' } });
      } else {
        navigate('/emails');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  if (issue?.status === 'sent') {
    return (
      <Card className="p-6 border border-[var(--color-bg-border)] text-center space-y-3">
        <Badge variant="success">Sent</Badge>
        <p className="text-sm">This issue was already dispatched.</p>
        {issue.campaignId && (
          <Button variant="secondary" onClick={() => navigate(`/campaign/${issue.campaignId}`)}>
            View campaign analytics
          </Button>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 border border-[var(--color-bg-border)] space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2"><Send size={16} /> Send {issue?.weekKey}</h3>
        <Input label="Campaign title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input label="Email subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <NexusDropdown
          label="Sender profile"
          value={senderProfileId}
          onChange={setSenderProfileId}
          options={profileOptions}
          placeholder="Select SMTP profile"
        />
      </Card>

      <Card className="p-4 border border-[var(--color-bg-border)] space-y-4">
        <h3 className="text-sm font-bold flex items-center gap-2"><Users size={16} /> Audience</h3>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Newsletter subscribers</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">Website newsletter signups (Data Hub)</p>
          </div>
          <Switch checked={newsletterSubscribers} onChange={setNewsletterSubscribers} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Artist Path applicants</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">Questionnaire responses</p>
          </div>
          <Switch checked={artistPath} onChange={setArtistPath} />
        </div>

        <NexusDropdown
          label="Exly offerings (Artist Path bookings)"
          value={exlyOfferingIds}
          onChange={setExlyOfferingIds}
          options={exlyOptions}
          multi
          placeholder="Select Exly offerings"
        />

        <div>
          <p className="text-xs font-bold mb-2 flex items-center gap-2"><Database size={14} /> Data Hub folders</p>
          <NexusDropdown
            value={dataHubFolders}
            onChange={setDataHubFolders}
            options={folderOptions}
            multi
            placeholder="Add audience from Admin Data folders"
          />
        </div>

        <Input
          label="Manual emails (optional)"
          multiline
          rows={3}
          placeholder="one@example.com, two@example.com"
          value={manualEmailsText}
          onChange={(e) => setManualEmailsText(e.target.value)}
        />
      </Card>

      <Card className="p-4 border border-[var(--color-bg-border)] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold">Recipient preview</h3>
          <Button size="sm" variant="secondary" onClick={refreshAudiencePreview} disabled={audiencePreviewMutation.isPending}>
            Refresh
          </Button>
        </div>
        {audiencePreview ? (
          <>
            <p className="text-2xl font-black text-[var(--color-pastel-mint-text)]">{audiencePreview.recipients.length}</p>
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest">
              sendable · {audiencePreview.skipped} skipped · {audiencePreview.totalResolved} resolved before filters
            </p>
            {audiencePreview.sourceBreakdown && (
              <div className="flex flex-wrap gap-2 pt-2">
                {Object.entries(audiencePreview.sourceBreakdown).map(([source, count]) => (
                  <Badge key={source} variant="slate" className="!text-[9px]">{source}: {count}</Badge>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-[var(--color-text-muted)]">Select audience sources to preview count</p>
        )}
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => navigate(`/emails/newsletter/curate?issue=${issue?._id}`)}>Back to curate</Button>
        <Button
          variant="primary"
          onClick={handleSend}
          disabled={sendMutation.isPending || compileMutation.isPending || !audiencePreview?.recipients?.length}
        >
          {sendMutation.isPending ? 'Sending…' : 'Send newsletter now'}
        </Button>
      </div>
    </div>
  );
};

export default NewsletterSendWizard;
