const MailCampaign = require('../models/MailCampaign');
const MailEvent = require('../models/MailEvent');
const EmailProfile = require('../models/EmailProfile');
const Lead = require('../../../models/Lead');
const { isAdminUser } = require('../../../utils/departmentPermissions');
const { dispatchCampaignJobs } = require('../../../services/queueService');

exports.list = async (req, res) => {
  try {
    const filter = isAdminUser(req.user) ? {} : { createdBy: req.user._id };
    const campaigns = await MailCampaign.find(filter).sort('-createdAt').lean();
    for (const camp of campaigns) {
      const total = camp.recipients?.length || 0;
      let sent = 0; let opened = 0; let clicked = 0; let bounced = 0; let unsubscribed = 0; let invalid = 0;
      camp.recipients?.forEach((r) => {
        if (r.status === 'Sent') sent++;
        if (r.status === 'Opened') { sent++; opened++; }
        if (r.status === 'Clicked') { sent++; opened++; clicked++; }
        if (r.status === 'Bounced' || r.status === 'Failed') bounced++;
        if (r.status === 'Invalid') { bounced++; invalid++; }
        if (r.status === 'Unsubscribed') unsubscribed++;
      });
      camp.stats = { total, sent, opened, clicked, bounced, unsubscribed, invalid };
    }
    res.json(campaigns);
  } catch (err) {
    console.error('Get campaigns error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { leadIds, customRecipients, ...rest } = req.body;
    const mongoose = require('mongoose');
    const validLeadIds = Array.isArray(leadIds) ? leadIds.filter((id) => mongoose.Types.ObjectId.isValid(id)) : [];
    const leads = validLeadIds.length ? await Lead.find({ _id: { $in: validLeadIds } }) : [];

    const recipients = leads.flatMap((l) => {
      const emails = l.email ? l.email.toLowerCase().split(/[,;]/).map((e) => e.trim()).filter(Boolean) : [];
      return emails.map((email) => ({
        leadId: l._id,
        email,
        status: 'Pending',
      }));
    });

    const custom = (Array.isArray(customRecipients) ? customRecipients : []).flatMap((r) => {
      const emails = r && r.email ? String(r.email).toLowerCase().split(/[,;]/).map((e) => e.trim()).filter(Boolean) : [];
      return emails.map((email) => ({ email, status: 'Pending' }));
    });

    const uniqueEmails = new Set();
    const allRecipients = [...recipients, ...custom].filter((r) => {
      if (uniqueEmails.has(r.email)) return false;
      uniqueEmails.add(r.email);
      return true;
    });

    const campaign = await MailCampaign.create({
      ...rest,
      attachments: rest.attachments || [],
      recipients: allRecipients,
      stats: { total: allRecipients.length, sent: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0, invalid: 0 },
      createdBy: req.user._id,
    });
    res.json(campaign);
  } catch (err) {
    console.error('Create campaign error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.send = async (req, res) => {
  try {
    const campaign = await MailCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (!isAdminUser(req.user) && campaign.createdBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to send this campaign' });
    }
    const result = await dispatchCampaignJobs(req.params.id);
    res.json({ message: 'Campaign dispatch started', ...result });
  } catch (err) {
    console.error('Send campaign error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.preview = async (req, res) => {
  try {
    const {
      content,
      subject,
      includeSignature,
      removeUnsubscribe,
      signature: signatureOverride,
      senderProfileId,
      sampleRecipient,
      variableMapping,
      dummyValues,
      format,
      theme,
    } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const {
      buildFinalEmailHtml, personalizeEmailContent, wrapPreviewDocument, applyFullDocumentEmailExtras,
    } = require('../../../utils/buildFinalEmailHtml');
    const { leadToRowData, applyIndexedVariables } = require('../../../utils/indexedTemplateVariables');

    let profile = null;
    if (senderProfileId) {
      profile = await EmailProfile.findById(senderProfileId);
    }

    const recipient = sampleRecipient && typeof sampleRecipient === 'object'
      ? {
        email: sampleRecipient.email || 'preview@example.com',
        name: sampleRecipient.name || '',
        rowData: sampleRecipient.rowData || leadToRowData(sampleRecipient),
      }
      : { email: 'preview@example.com', name: 'Preview', rowData: {} };

    let htmlIn = content;
    let subjectIn = subject || '';

    if (dummyValues && typeof dummyValues === 'object' && Object.keys(dummyValues).length > 0) {
      htmlIn = applyIndexedVariables(htmlIn, dummyValues);
      subjectIn = applyIndexedVariables(subjectIn, dummyValues);
    } else {
      const { html: personalizedHtml } = personalizeEmailContent({
        html: htmlIn,
        subject: subjectIn,
        recipient,
        leadDoc: null,
        variableMapping: variableMapping || {},
      });
      htmlIn = personalizedHtml;
      const { subject: personalizedSubject } = personalizeEmailContent({
        html: '',
        subject: subjectIn,
        recipient,
        variableMapping: variableMapping || {},
      });
      subjectIn = personalizedSubject;
    }

    const isRawHtml = format === 'rawHtml';
    const isFullDocument = /<!DOCTYPE|<html[\s>]/i.test((htmlIn || '').trim());
    const signatureText = (typeof signatureOverride === 'string' ? signatureOverride : '') || profile?.signature || '';
    const previewExtras = {
      includeSignature: includeSignature === true,
      signature: signatureText,
      removeUnsubscribe: removeUnsubscribe === true,
    };

    if (isFullDocument) {
      const html = applyFullDocumentEmailExtras(htmlIn, previewExtras);
      return res.json({ html, subject: subjectIn });
    }

    const bodyHtml = await buildFinalEmailHtml({
      html: htmlIn,
      format: isRawHtml ? 'rawHtml' : 'visual',
      ...previewExtras,
      mode: 'preview',
    });

    res.json({
      html: wrapPreviewDocument(bodyHtml, { theme: theme === 'dark' ? 'dark' : 'light' }),
      subject: subjectIn,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.testCampaign = async (req, res) => {
  try {
    const {
      subject, content, testEmail, senderProfileId, includeSignature,
      senderMode, senderProfileIds, removeUnsubscribe, signature: signatureOverride,
      resendFromEmail, variableMapping, sampleRecipient, format, attachments,
    } = req.body;

    if (!subject || !content || !testEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const mode = senderMode || 'single';
    if (mode === 'single' && !senderProfileId) {
      return res.status(400).json({ error: 'Select a sender profile, or choose System Resend / System SMTP mode.' });
    }
    if (mode === 'pool' && (!senderProfileIds || senderProfileIds.length === 0)) {
      return res.status(400).json({ error: 'Select at least one profile for pool mode test send.' });
    }

    let profile = null;
    const profileIdForSig = senderProfileId || senderProfileIds?.[0];
    if (profileIdForSig) {
      profile = await EmailProfile.findById(profileIdForSig);
      if (!profile && mode === 'single') {
        return res.status(404).json({ error: 'Sender profile not found' });
      }
    }

    if (mode === 'pool' && senderProfileIds?.length) {
      profile = await EmailProfile.findById(senderProfileIds[0]);
    }

    if (mode === 'system_resend' || mode === 'system_smtp') {
      const { displayNameForResendEmail, isVerifiedResendEmail } = require('../../../utils/resendFromEmails');
      const fromEmail = (mode === 'system_resend' && isVerifiedResendEmail(resendFromEmail))
        ? resendFromEmail.trim().toLowerCase()
        : (process.env.SYSTEM_VERIFIED_FROM_EMAIL || process.env.SMTP_USER || 'onboarding@resend.dev').trim().toLowerCase();
      profile = profile || {
        name: mode === 'system_resend' ? displayNameForResendEmail(fromEmail) : 'System SMTP',
        email: fromEmail,
        smtpHost: '',
        smtpPort: 587,
        smtpUser: '',
        smtpPass: '',
      };
    }

    const { buildFinalEmailHtml, personalizeEmailContent, applyFullDocumentEmailExtras } = require('../../../utils/buildFinalEmailHtml');
    const { isFullHtmlDocument } = require('../../../utils/normalizeOutboundEmailHtml');
    const { leadToRowData } = require('../../../utils/indexedTemplateVariables');
    const recipient = sampleRecipient && typeof sampleRecipient === 'object'
      ? {
        email: testEmail,
        name: sampleRecipient.name || '',
        rowData: sampleRecipient.rowData || leadToRowData(sampleRecipient),
      }
      : { email: testEmail, name: '', rowData: {} };

    const { html: personalizedHtml, subject: mergedSubject } = personalizeEmailContent({
      html: content,
      subject,
      recipient,
      variableMapping: variableMapping || {},
    });

    const signatureText = (typeof signatureOverride === 'string' ? signatureOverride : '') || profile?.signature || '';
    const previewExtras = {
      includeSignature: includeSignature === true,
      signature: signatureText,
      removeUnsubscribe: removeUnsubscribe === true,
    };
    const isFullDoc = isFullHtmlDocument(personalizedHtml);
    const html = isFullDoc
      ? applyFullDocumentEmailExtras(personalizedHtml, previewExtras)
      : await buildFinalEmailHtml({
        html: personalizedHtml,
        format: format === 'rawHtml' ? 'rawHtml' : 'visual',
        ...previewExtras,
        mode: 'test',
      });

    const { loadCampaignAttachments } = require('../../../utils/campaignAttachments');
    const attachmentRows = await loadCampaignAttachments(attachments || []);

    const mailService = require('../services/mailService');
    await mailService.sendTestEmail({
      to: testEmail,
      subject: mergedSubject,
      html,
      profile,
      senderMode: mode,
      skipPipeline: true,
      attachmentRows,
    });

    res.json({ success: true, message: `Test email sent to ${testEmail}` });
  } catch (err) {
    console.error('Test campaign error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const campaign = await MailCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (!isAdminUser(req.user) && campaign.createdBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to delete this campaign' });
    }
    const campaignId = req.params.id;
    await MailCampaign.findByIdAndDelete(campaignId);
    await MailEvent.deleteMany({ campaignId });
    res.json({ message: 'Campaign and related tracking data deleted successfully' });
  } catch (err) {
    console.error('Delete campaign error:', err);
    res.status(500).json({ error: err.message });
  }
};
