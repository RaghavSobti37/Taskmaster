const Contact = require('../models/Contact');
const Lead = require('../models/Lead');
const TscData = require('../models/TscData');
const ExlyBooking = require('../models/ExlyBooking');
const Task = require('../models/Task');
const MailEvent = require('../models/MailEvent');
const CRMAudit = require('../models/CRMAudit');
const EMI = require('../models/EMI');
const User = require('../models/User');
const ContactService = require('./ContactService');
const { buildDataHubExcludeFilter } = require('./qa/qaTestData');
const DataHubSyncState = require('../models/DataHubSyncState');
const { escapeRegExp } = require('../utils/sanitizer');
const {
  DATA_INLETS,
  INLET_KEYS,
  isBookedCallSource,
  isCommunityText,
  BOOKED_CALL_SOURCE_RE,
  dedupeInletEntries,
} = require('../../shared/dataInlets');

const FOLDER_CACHE_TTL_MS = 5 * 60 * 1000;
const INCREMENTAL_BOOTSTRAP_MS = 24 * 60 * 60 * 1000; // first run: last 24h only
const CONTACT_BYPASS = { bypassTenant: true };
const CUSTOMER_ROLE_MATCH = { role: { $in: ['Customer', 'customer', null] } };
const WEEKLY_DATE_FORMAT = '%Y-%U';
let folderCache = { data: null, expiresAt: 0 };

const changedSince = (since) => {
  if (!since) return {};
  return {
    $or: [
      { createdAt: { $gte: since } },
      { updatedAt: { $gte: since } },
    ],
  };
};

const identityMatch = (email, phone) => {
  const clauses = [];
  if (email) clauses.push({ email });
  if (phone) clauses.push({ phone });
  return clauses.length ? { $or: clauses } : null;
};

const buildFolderQuery = (folder, extra = {}) => {
  const base = { role: { $in: ['Customer', 'customer', null] } };
  const q = { ...base, ...extra };

  switch (folder) {
    case 'all':
      break;
    case 'exly':
      q.inExly = true;
      break;
    case 'leads':
      q.inCRM = true;
      break;
    case 'tsc':
      q.inTsc = true;
      break;
    case 'booked_calls':
      q.inBookedCalls = true;
      break;
    case 'enquiries':
      q.inEnquiries = true;
      break;
    case 'unsubscribed':
      q.$or = [{ unsubscribed: true }, { emailStatus: 'Unsubscribed' }];
      break;
    case 'mail':
      q.inMailer = true;
      break;
    case 'community':
      q.inCommunity = true;
      break;
    case 'active':
      q.emailStatus = 'Active';
      q.$or = [
        { inMailer: true },
        { inExly: true },
        { inCRM: true },
        { inletCount: { $gte: 1 } },
      ];
      break;
    case 'loyal':
      q.isMultiInlet = true;
      break;
    default:
      break;
  }
  q.$and = q.$and || [];
  q.$and.push(buildDataHubExcludeFilter());
  return q;
};

function parseEnquiryDescription(description = '') {
  const fields = {};
  const patterns = {
    name: /^Name:\s*(.+)$/m,
    company: /^Company:\s*(.+)$/m,
    email: /^Email:\s*(.+)$/m,
    phone: /^Phone:\s*(.+)$/m,
    collaborationType: /^Collaboration type:\s*(.+)$/m,
    artist: /^Artist \/ talent:\s*(.+)$/m,
    nature: /^Project nature:\s*(.+)$/m,
    whenWhere: /^When & where:\s*(.+)$/m,
    scaleReach: /^Scale \/ reach:\s*(.+)$/m,
    logistics: /^Logistics:\s*(.+)$/m,
    vision: /^Vision \/ details:\s*(.+)$/m,
  };
  for (const [key, re] of Object.entries(patterns)) {
    const m = description.match(re);
    if (m) fields[key] = m[1].trim();
  }
  return fields;
}

class DataHubService {
  async reconcilePerson(email, phone) {
    const match = identityMatch(email, phone);
    if (!match) return null;

    const [leads, tscRows, exlyBookings, enquiryTasks] = await Promise.all([
      Lead.find(match).lean(),
      TscData.find(match).lean(),
      ExlyBooking.find(match).lean(),
      Task.find({ type: 'enquiry', description: { $regex: escapeRegExp(email || phone), $options: 'i' } }).lean(),
    ]);

    let contact = null;
    const primaryName = leads[0]?.name || tscRows[0]?.name || exlyBookings[0]?.name || 'Anonymous';

    for (const lead of leads) {
      const inletKey = isBookedCallSource(lead.source) ? 'booked_calls' : 'leads';
      contact = await ContactService.mergeContact({
        name: lead.name || primaryName,
        email: lead.email || email,
        phone: lead.phone || phone,
        city: lead.city,
        leadStatus: lead.leadStatus,
        leadQuality: lead.leadQuality,
        emailStatus: lead.emailStatus,
        unsubscribed: lead.unsubscribed,
        unsubscribeReason: lead.unsubscribeReason,
        recordId: lead._id,
        summary: { source: lead.source, leadStatus: lead.leadStatus, callStatus: lead.callStatus },
      }, inletKey === 'booked_calls' ? 'booked_calls' : 'crm');
    }

    for (const row of tscRows) {
      const isCommunity = isCommunityText(row.campaign) || isCommunityText(row.originSource);
      contact = await ContactService.mergeContact({
        name: row.name || primaryName,
        email: row.email || email,
        phone: row.phone || phone,
        city: row.city,
        sourceFilename: row.sourceFilename,
        emailStatus: row.emailStatus,
        recordId: row._id,
        summary: { campaign: row.campaign, originSource: row.originSource, role: row.role },
        inletKey: isCommunity ? 'community' : 'tsc',
      }, isCommunity ? 'community' : 'tsc');
    }

    for (const booking of exlyBookings) {
      const isCommunity = isCommunityText(booking.offeringTitle);
      contact = await ContactService.mergeContact({
        name: booking.name || primaryName,
        email: booking.email || email,
        phone: booking.phone || phone,
        exlyOfferingTitle: booking.offeringTitle,
        emailStatus: booking.emailStatus,
        unsubscribed: booking.unsubscribed,
        recordId: booking._id,
        summary: { offeringTitle: booking.offeringTitle, pricePaid: booking.pricePaid },
        inletKey: isCommunity ? 'community' : 'exly',
      }, isCommunity ? 'community' : 'exly');
    }

    for (const task of enquiryTasks) {
      const parsed = parseEnquiryDescription(task.description);
      contact = await ContactService.mergeContact({
        name: parsed.name || primaryName,
        email: parsed.email || email,
        phone: parsed.phone || phone,
        recordId: task._id,
        summary: { artist: parsed.artist, company: parsed.company, collaborationType: parsed.collaborationType },
        inletKey: 'enquiries',
      }, 'enquiries');
    }

    if (email) {
      const mailCount = await MailEvent.countDocuments({ email: new RegExp(`^${escapeRegExp(email)}$`, 'i') });
      if (mailCount > 0) {
        contact = await ContactService.mergeContact({
          name: primaryName,
          email,
          phone,
          inletKey: 'mail',
          summary: { mailEventCount: mailCount },
        }, 'mailer');
      }
    }

    folderCache = { data: null, expiresAt: 0 };
    return contact;
  }

  async listPeople({ folder = 'all', search = '', page = 1, limit = 25, campaign, originSource, emailStatus }) {
    const query = buildFolderQuery(folder);

    if (search) {
      const escaped = escapeRegExp(search);
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { name: { $regex: escaped, $options: 'i' } },
          { email: { $regex: escaped, $options: 'i' } },
          { phone: { $regex: escaped, $options: 'i' } },
        ],
      });
    }

    if (emailStatus && emailStatus !== 'all') {
      query.emailStatus = emailStatus;
    }

    // TSC sub-folder filters require matching TscData then filtering contacts
    if ((campaign && campaign !== 'all') || (originSource && originSource !== 'all')) {
      const tscFilter = {};
      if (campaign && campaign !== 'all') tscFilter.campaign = campaign;
      if (originSource && originSource !== 'all') tscFilter.originSource = originSource;
      const tscRows = await TscData.find(tscFilter).select('email phone').lean();
      const emails = tscRows.map((r) => r.email).filter(Boolean);
      const phones = tscRows.map((r) => r.phone).filter(Boolean);
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          ...(emails.length ? [{ email: { $in: emails } }] : []),
          ...(phones.length ? [{ phone: { $in: phones } }] : []),
        ],
      });
      if (!query.$and[query.$and.length - 1].$or.length) {
        return { data: [], total: 0, page, pages: 0 };
      }
    }

    const skip = (page - 1) * limit;
    const [total, data] = await Promise.all([
      Contact.countDocuments(query).setOptions(CONTACT_BYPASS),
      Contact.find(query)
        .setOptions(CONTACT_BYPASS)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return {
      data: data.map((c) => {
        const inlets = dedupeInletEntries(c.inlets || []);
        return {
          ...c,
          inlets,
          inletCount: inlets.length,
          isMultiInlet: inlets.length >= 2,
          inletLabels: inlets.map((i) => DATA_INLETS[i.key]?.label || i.key),
        };
      }),
      total,
      page,
      pages: Math.ceil(total / limit) || 0,
    };
  }

  async getPersonBase(contactId) {
    const contact = await Contact.findById(contactId).setOptions(CONTACT_BYPASS).lean();
    if (!contact) return null;
    contact.inlets = dedupeInletEntries(contact.inlets || []);
    return {
      contact,
      overview: {
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        city: contact.city,
        inletCount: contact.inletCount,
        isMultiInlet: contact.isMultiInlet,
        inlets: contact.inlets || [],
        emailStatus: contact.emailStatus,
        unsubscribed: contact.unsubscribed,
        firstSeen: contact.createdAt,
        lastSeen: contact.updatedAt,
        exlyRevenue: 0,
      },
    };
  }

  async getPersonSection(contactId, section) {
    const contact = await Contact.findById(contactId).setOptions(CONTACT_BYPASS).lean();
    if (!contact) return null;
    contact.inlets = dedupeInletEntries(contact.inlets || []);
    const match = identityMatch(contact.email, contact.phone);
    if (!match) {
      return { section, contact, overview: { inlets: contact.inlets || [] } };
    }

    if (section === 'crm') {
      const leads = await Lead.find(match).sort({ updatedAt: -1 }).lean();
      const leadIds = leads.map((l) => l._id);
      const [audits, emis, reps] = await Promise.all([
        leadIds.length ? CRMAudit.find({ leadId: { $in: leadIds } }).sort({ timestamp: -1 }).limit(50).lean() : [],
        leadIds.length ? EMI.find({ leadId: { $in: leadIds } }).sort({ dueDate: 1 }).lean() : [],
        (async () => {
          const repIds = [...new Set(leads.map((l) => String(l.assignedRepId)).filter(Boolean))];
          if (!repIds.length) return {};
          const users = await User.find({ _id: { $in: repIds } }).select('name email').lean();
          return Object.fromEntries(users.map((u) => [String(u._id), u]));
        })(),
      ]);
      return { section, crm: { leads, audits, emis, reps } };
    }

    if (section === 'exly') {
      const bookings = await ExlyBooking.find(match).sort({ bookedOn: -1 }).lean();
      const revenue = bookings.reduce((sum, b) => sum + (Number(b.pricePaid) || 0), 0);
      return {
        section,
        exly: {
          bookings,
          revenue,
          offerings: [...new Set(bookings.map((b) => b.offeringTitle))],
        },
      };
    }

    if (section === 'tsc') {
      const rows = await TscData.find(match).sort({ createdAt: -1 }).lean();
      return { section, tsc: { rows } };
    }

    if (section === 'booked') {
      const leads = await Lead.find(match).sort({ updatedAt: -1 }).lean();
      return { section, bookedCalls: { leads: leads.filter((l) => isBookedCallSource(l.source)) } };
    }

    if (section === 'enquiries') {
      const enquiryTasks = await Task.find({ type: 'enquiry' }).sort({ createdAt: -1 }).limit(200).lean();
      const filtered = enquiryTasks.filter((t) => {
        const parsed = parseEnquiryDescription(t.description);
        const eMatch = contact.email && parsed.email?.toLowerCase() === contact.email.toLowerCase();
        const pMatch = contact.phone && parsed.phone === contact.phone;
        return eMatch || pMatch || (t.description || '').includes(contact.email || '') || (t.description || '').includes(contact.phone || '');
      });
      return {
        section,
        enquiries: filtered.map((t) => ({ ...t, parsed: parseEnquiryDescription(t.description) })),
      };
    }

    if (section === 'mail') {
      const events = contact.email
        ? await MailEvent.find({ email: new RegExp(`^${escapeRegExp(contact.email)}$`, 'i') })
          .sort({ timestamp: -1 }).limit(100).lean()
        : [];
      return { section, mail: { events } };
    }

    if (section === 'timeline') {
      const [leads, tscRows, exlyBookings, enquiryTasks, mailEvents] = await Promise.all([
        Lead.find(match).sort({ updatedAt: -1 }).lean(),
        TscData.find(match).sort({ createdAt: -1 }).lean(),
        ExlyBooking.find(match).sort({ bookedOn: -1 }).lean(),
        Task.find({ type: 'enquiry' }).sort({ createdAt: -1 }).limit(200).lean(),
        contact.email
          ? MailEvent.find({ email: new RegExp(`^${escapeRegExp(contact.email)}$`, 'i') })
            .sort({ timestamp: -1 }).limit(100).lean()
          : [],
      ]);
      const filteredEnquiries = enquiryTasks.filter((t) => {
        const parsed = parseEnquiryDescription(t.description);
        const eMatch = contact.email && parsed.email?.toLowerCase() === contact.email.toLowerCase();
        const pMatch = contact.phone && parsed.phone === contact.phone;
        return eMatch || pMatch || (t.description || '').includes(contact.email || '') || (t.description || '').includes(contact.phone || '');
      });
      const timeline = [];
      for (const lead of leads) {
        timeline.push({ type: 'lead', date: lead.updatedAt || lead.createdAt, label: `Lead: ${lead.leadStatus}`, data: lead });
      }
      for (const row of tscRows) {
        timeline.push({ type: 'tsc', date: row.createdAt, label: `TSC: ${row.campaign || row.originSource || 'import'}`, data: row });
      }
      for (const b of exlyBookings) {
        timeline.push({ type: 'exly', date: b.bookedOn || b.createdAt, label: `Exly: ${b.offeringTitle}`, data: b });
      }
      for (const t of filteredEnquiries) {
        timeline.push({ type: 'enquiry', date: t.createdAt, label: `Enquiry: ${t.title}`, data: t });
      }
      for (const evt of mailEvents) {
        timeline.push({ type: 'mail', date: evt.timestamp || evt.createdAt, label: `Mail ${evt.eventType}`, data: evt });
      }
      timeline.sort((a, b) => new Date(b.date) - new Date(a.date));
      return { section, timeline };
    }

    if (section === 'overview') {
      const bookings = await ExlyBooking.find(match).select('pricePaid bookedOn').lean();
      const exlyRevenue = bookings.reduce((sum, b) => sum + (Number(b.pricePaid) || 0), 0);
      const crmCount = await Lead.countDocuments(match);
      const exlyCount = bookings.length;
      return {
        section,
        overview: {
          exlyRevenue,
          crmLeadCount: crmCount,
          exlyBookingCount: exlyCount,
        },
      };
    }

    return { section, data: null };
  }

  async getPerson360(contactId) {
    const contact = await Contact.findById(contactId).setOptions(CONTACT_BYPASS).lean();
    if (!contact) return null;
    contact.inlets = dedupeInletEntries(contact.inlets || []);

    const match = identityMatch(contact.email, contact.phone);
    if (!match) return { contact, overview: contact };

    const [leads, tscRows, exlyBookings, enquiryTasks, mailEvents] = await Promise.all([
      Lead.find(match).sort({ updatedAt: -1 }).lean(),
      TscData.find(match).sort({ createdAt: -1 }).lean(),
      ExlyBooking.find(match).sort({ bookedOn: -1 }).lean(),
      Task.find({ type: 'enquiry' }).sort({ createdAt: -1 }).limit(200).lean(),
      contact.email
        ? MailEvent.find({ email: new RegExp(`^${escapeRegExp(contact.email)}$`, 'i') })
          .sort({ timestamp: -1 }).limit(100).lean()
        : [],
    ]);

    const filteredEnquiries = enquiryTasks.filter((t) => {
      const parsed = parseEnquiryDescription(t.description);
      const eMatch = contact.email && parsed.email?.toLowerCase() === contact.email.toLowerCase();
      const pMatch = contact.phone && parsed.phone === contact.phone;
      return eMatch || pMatch || (t.description || '').includes(contact.email || '') || (t.description || '').includes(contact.phone || '');
    });

    const leadIds = leads.map((l) => l._id);
    const [audits, emis, reps] = await Promise.all([
      leadIds.length ? CRMAudit.find({ leadId: { $in: leadIds } }).sort({ timestamp: -1 }).limit(50).lean() : [],
      leadIds.length ? EMI.find({ leadId: { $in: leadIds } }).sort({ dueDate: 1 }).lean() : [],
      (async () => {
        const repIds = [...new Set(leads.map((l) => String(l.assignedRepId)).filter(Boolean))];
        if (!repIds.length) return {};
        const users = await User.find({ _id: { $in: repIds } }).select('name email').lean();
        return Object.fromEntries(users.map((u) => [String(u._id), u]));
      })(),
    ]);

    const bookedCalls = leads.filter((l) => isBookedCallSource(l.source));

    const timeline = [];
    for (const lead of leads) {
      timeline.push({ type: 'lead', date: lead.updatedAt || lead.createdAt, label: `Lead: ${lead.leadStatus}`, data: lead });
    }
    for (const row of tscRows) {
      timeline.push({ type: 'tsc', date: row.createdAt, label: `TSC: ${row.campaign || row.originSource || 'import'}`, data: row });
    }
    for (const b of exlyBookings) {
      timeline.push({ type: 'exly', date: b.bookedOn || b.createdAt, label: `Exly: ${b.offeringTitle}`, data: b });
    }
    for (const t of filteredEnquiries) {
      timeline.push({ type: 'enquiry', date: t.createdAt, label: `Enquiry: ${t.title}`, data: t });
    }
    for (const evt of mailEvents) {
      timeline.push({ type: 'mail', date: evt.timestamp || evt.createdAt, label: `Mail ${evt.eventType}`, data: evt });
    }
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    const exlyRevenue = exlyBookings.reduce((sum, b) => sum + (Number(b.pricePaid) || 0), 0);

    return {
      contact,
      overview: {
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        city: contact.city,
        inletCount: contact.inletCount,
        isMultiInlet: contact.isMultiInlet,
        inlets: contact.inlets || [],
        emailStatus: contact.emailStatus,
        unsubscribed: contact.unsubscribed,
        exlyRevenue,
        firstSeen: timeline.length ? timeline[timeline.length - 1].date : contact.createdAt,
        lastSeen: timeline.length ? timeline[0].date : contact.updatedAt,
      },
      crm: { leads, audits, emis, reps },
      exly: { bookings: exlyBookings, revenue: exlyRevenue, offerings: [...new Set(exlyBookings.map((b) => b.offeringTitle))] },
      tsc: { rows: tscRows },
      bookedCalls: { leads: bookedCalls },
      enquiries: filteredEnquiries.map((t) => ({ ...t, parsed: parseEnquiryDescription(t.description) })),
      mail: { events: mailEvents },
      timeline,
    };
  }

  async getFolderCounts() {
    const now = Date.now();
    if (folderCache.data && folderCache.expiresAt > now) {
      return folderCache.data;
    }

    const folderKeys = ['all', ...INLET_KEYS, 'loyal'];
    const counts = {};
    await Promise.all(
      folderKeys.map(async (key) => {
        counts[key] = await Contact.countDocuments(buildFolderQuery(key)).setOptions(CONTACT_BYPASS);
      })
    );

    const [campaigns, sources] = await Promise.all([
      TscData.aggregate([
        { $match: { campaign: { $nin: [null, ''] } } },
        { $group: { _id: '$campaign', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),
      TscData.aggregate([
        { $match: { originSource: { $nin: [null, ''] } } },
        { $group: { _id: '$originSource', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),
    ]);

    const folders = folderKeys.map((key) => ({
      key,
      label: DATA_INLETS[key]?.label || key,
      count: counts[key] || 0,
      children: key === 'tsc'
        ? [
          ...campaigns.map((c) => ({ key: `tsc:campaign:${c._id}`, label: c._id, count: c.count, filter: { campaign: c._id } })),
          ...sources.map((s) => ({ key: `tsc:source:${s._id}`, label: s._id, count: s.count, filter: { originSource: s._id } })),
        ]
        : undefined,
    }));

    folderCache = { data: { folders, counts }, expiresAt: now + FOLDER_CACHE_TTL_MS };
    return folderCache.data;
  }

  async getAnalytics(folder = 'all') {
    if (folder === 'all') return this.getGlobalAnalytics();
    if (folder === 'loyal') return this.getLoyalAnalytics();
    return this.getInletAnalytics(folder);
  }

  _weekAgo() {
    return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }

  _monthAgo() {
    return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }

  async getGlobalAnalytics() {
    const [
      totalContacts,
      emailHealth,
      inletBreakdown,
      newThisWeek,
      overlapPairs,
    ] = await Promise.all([
      Contact.countDocuments(CUSTOMER_ROLE_MATCH).setOptions(CONTACT_BYPASS),
      Contact.aggregate([
        { $match: CUSTOMER_ROLE_MATCH },
        { $group: { _id: '$emailStatus', count: { $sum: 1 } } },
      ]),
      Contact.aggregate([
        { $match: CUSTOMER_ROLE_MATCH },
        { $unwind: { path: '$inlets', preserveNullAndEmptyArrays: false } },
        { $group: { _id: '$inlets.key', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Contact.countDocuments({
        ...CUSTOMER_ROLE_MATCH,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }).setOptions(CONTACT_BYPASS),
      this.getOverlapMatrix(),
    ]);

    const growth = await Contact.aggregate([
      {
        $match: {
          ...CUSTOMER_ROLE_MATCH,
          createdAt: {
            $gte: new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000),
            $type: 'date',
          },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: WEEKLY_DATE_FORMAT, date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      folder: 'all',
      label: DATA_INLETS.all.label,
      totalContacts,
      newThisWeek,
      kpis: [
        { key: 'total', label: 'Unique People', value: totalContacts },
        { key: 'newWeek', label: 'New This Week', value: newThisWeek },
        { key: 'loyal', label: 'Loyal (2+ Inlets)', value: await Contact.countDocuments({ isMultiInlet: true }).setOptions(CONTACT_BYPASS) },
        {
          key: 'unsubRate',
          label: 'Unsub Rate',
          value: totalContacts
            ? Math.round(((emailHealth.find((e) => e._id === 'Unsubscribed')?.count || 0) / totalContacts) * 100)
            : 0,
          format: 'percent',
        },
      ],
      emailHealth: emailHealth.map((r) => ({ status: r._id || 'Unknown', count: r.count })),
      inletBreakdown: inletBreakdown.map((r) => ({
        key: r._id,
        label: DATA_INLETS[r._id]?.label || r._id,
        count: r.count,
      })),
      growth,
      overlap: overlapPairs,
      loyalCount: await Contact.countDocuments({ isMultiInlet: true }).setOptions(CONTACT_BYPASS),
    };
  }

  async getLoyalAnalytics() {
    const total = await Contact.countDocuments({ isMultiInlet: true }).setOptions(CONTACT_BYPASS);
    const overlap = await this.getOverlapMatrix();

    const inletDistribution = await Contact.aggregate([
      { $match: { isMultiInlet: true } },
      { $group: { _id: '$inletCount', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const topInletsAmongLoyal = await Contact.aggregate([
      { $match: { isMultiInlet: true } },
      { $unwind: '$inlets' },
      { $group: { _id: '$inlets.key', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const avgInlets = total
      ? (await Contact.aggregate([
        { $match: { isMultiInlet: true } },
        { $group: { _id: null, avg: { $avg: '$inletCount' } } },
      ]))[0]?.avg || 0
      : 0;

    const newLoyalThisWeek = await Contact.countDocuments({
      isMultiInlet: true,
      updatedAt: { $gte: this._weekAgo() },
    }).setOptions(CONTACT_BYPASS);

    return {
      folder: 'loyal',
      label: DATA_INLETS.loyal.label,
      total,
      kpis: [
        { key: 'total', label: 'Loyal Customers', value: total },
        { key: 'avgInlets', label: 'Avg Inlets / Person', value: Math.round(avgInlets * 10) / 10 },
        { key: 'newWeek', label: 'Updated This Week', value: newLoyalThisWeek },
        { key: 'topPair', label: 'Top Overlap Pair', value: overlap[0] ? `${overlap[0].count}` : 0 },
      ],
      overlap,
      inletDistribution: inletDistribution.map((r) => ({
        label: `${r._id} inlets`,
        count: r.count,
      })),
      topInletsAmongLoyal: topInletsAmongLoyal.map((r) => ({
        label: DATA_INLETS[r._id]?.label || r._id,
        count: r.count,
      })),
    };
  }

  async getInletAnalytics(folder) {
    const query = buildFolderQuery(folder);
    const total = await Contact.countDocuments(query).setOptions(CONTACT_BYPASS);
    const weekAgo = this._weekAgo();
    const monthAgo = this._monthAgo();

    const result = { folder, total, label: DATA_INLETS[folder]?.label || folder, kpis: [] };

    if (folder === 'leads') {
      const [funnel, callStatus, sources, quality, connect, newWeek, converted] = await Promise.all([
        Lead.aggregate([{ $group: { _id: '$leadStatus', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
        Lead.aggregate([{ $group: { _id: '$callStatus', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
        Lead.aggregate([{ $group: { _id: '$source', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
        Lead.aggregate([{ $group: { _id: '$leadQuality', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
        Lead.aggregate([{ $group: { _id: '$meaningfulConnect', count: { $sum: 1 } } }]),
        Lead.countDocuments({ createdAt: { $gte: weekAgo } }),
        Lead.countDocuments({ leadStatus: { $regex: /convert/i } }),
      ]);
      const leadTotal = await Lead.countDocuments({});
      const connectYes = connect.find((c) => c._id === 'YES')?.count || 0;
      result.funnel = funnel;
      result.callStatus = callStatus;
      result.sources = sources;
      result.quality = quality;
      result.meaningfulConnect = connect;
      result.kpis = [
        { key: 'total', label: 'CRM Leads', value: leadTotal },
        { key: 'newWeek', label: 'New This Week', value: newWeek },
        { key: 'connected', label: 'Meaningful Connect', value: connectYes },
        {
          key: 'conversion',
          label: 'Conversion Rate',
          value: leadTotal ? Math.round((converted / leadTotal) * 100) : 0,
          format: 'percent',
        },
      ];
    }

    if (folder === 'exly') {
      const [revenueAgg, topOfferings, newMonth, bookingTrend] = await Promise.all([
        ExlyBooking.aggregate([
          { $group: { _id: null, revenue: { $sum: '$pricePaid' }, count: { $sum: 1 } } },
        ]),
        ExlyBooking.aggregate([
          { $group: { _id: '$offeringTitle', count: { $sum: 1 }, revenue: { $sum: '$pricePaid' } } },
          { $sort: { revenue: -1 } },
          { $limit: 10 },
        ]),
        ExlyBooking.countDocuments({ bookedOn: { $gte: monthAgo } }),
        ExlyBooking.aggregate([
          { $match: { bookedOn: { $gte: new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000) } } },
          { $group: { _id: { $dateToString: { format: WEEKLY_DATE_FORMAT, date: '$bookedOn' } }, count: { $sum: 1 }, revenue: { $sum: '$pricePaid' } } },
          { $sort: { _id: 1 } },
        ]),
      ]);
      const rev = revenueAgg[0] || { revenue: 0, count: 0 };
      result.topOfferings = topOfferings;
      result.bookingTrend = bookingTrend;
      result.kpis = [
        { key: 'bookings', label: 'Total Bookings', value: rev.count },
        { key: 'revenue', label: 'Total Revenue', value: Math.round(rev.revenue || 0), format: 'currency' },
        {
          key: 'avgTicket',
          label: 'Avg Ticket',
          value: rev.count ? Math.round((rev.revenue || 0) / rev.count) : 0,
          format: 'currency',
        },
        { key: 'newMonth', label: 'Bookings (30d)', value: newMonth },
      ];
    }

    if (folder === 'tsc') {
      const [topCampaigns, topSources, roles, emailBreakdown, tscTotal, withEmail, withPhone, crmLinked] = await Promise.all([
        TscData.aggregate([{ $group: { _id: '$campaign', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
        TscData.aggregate([{ $group: { _id: '$originSource', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
        TscData.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
        TscData.aggregate([{ $group: { _id: '$emailStatus', count: { $sum: 1 } } }]),
        TscData.countDocuments({}),
        TscData.countDocuments({ email: { $nin: [null, ''] } }),
        TscData.countDocuments({ phone: { $nin: [null, ''] } }),
        Contact.countDocuments({ inTsc: true, inCRM: true }).setOptions(CONTACT_BYPASS),
      ]);
      result.topCampaigns = topCampaigns;
      result.topSources = topSources;
      result.roles = roles;
      result.emailBreakdown = emailBreakdown;
      result.kpis = [
        { key: 'records', label: 'TSC Records', value: tscTotal },
        { key: 'withEmail', label: 'Has Email', value: withEmail },
        { key: 'withPhone', label: 'Has Phone', value: withPhone },
        {
          key: 'crmLinked',
          label: 'Also in CRM',
          value: tscTotal ? Math.round((crmLinked / Math.max(total, 1)) * 100) : 0,
          format: 'percent',
        },
      ];
    }

    if (folder === 'booked_calls') {
      const bookedMatch = { source: { $regex: BOOKED_CALL_SOURCE_RE } };
      const [funnel, callStatus, newWeek, connected, totalBooked] = await Promise.all([
        Lead.aggregate([{ $match: bookedMatch }, { $group: { _id: '$leadStatus', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
        Lead.aggregate([{ $match: bookedMatch }, { $group: { _id: '$callStatus', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
        Lead.countDocuments({ ...bookedMatch, createdAt: { $gte: weekAgo } }),
        Lead.countDocuments({ ...bookedMatch, meaningfulConnect: 'YES' }),
        Lead.countDocuments(bookedMatch),
      ]);
      result.funnel = funnel;
      result.callStatus = callStatus;
      result.kpis = [
        { key: 'total', label: 'Booked Calls', value: totalBooked },
        { key: 'newWeek', label: 'New This Week', value: newWeek },
        { key: 'connected', label: 'Meaningful Connect', value: connected },
        {
          key: 'connectRate',
          label: 'Connect Rate',
          value: totalBooked ? Math.round((connected / totalBooked) * 100) : 0,
          format: 'percent',
        },
      ];
    }

    if (folder === 'enquiries') {
      const tasks = await Task.find({ type: 'enquiry' }).select('description createdAt').lean();
      const byArtist = {};
      const byCollab = {};
      let thisMonth = 0;
      for (const t of tasks) {
        const parsed = parseEnquiryDescription(t.description);
        const artist = parsed.artist || 'Unknown';
        const collab = parsed.collaborationType || 'Unknown';
        byArtist[artist] = (byArtist[artist] || 0) + 1;
        byCollab[collab] = (byCollab[collab] || 0) + 1;
        if (t.createdAt && t.createdAt >= monthAgo) thisMonth += 1;
      }
      result.byArtist = Object.entries(byArtist).map(([artist, count]) => ({ artist, count })).sort((a, b) => b.count - a.count).slice(0, 10);
      result.byCollab = Object.entries(byCollab).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 10);
      result.kpis = [
        { key: 'total', label: 'Total Enquiries', value: tasks.length },
        { key: 'month', label: 'This Month', value: thisMonth },
        { key: 'artists', label: 'Unique Artists', value: Object.keys(byArtist).length },
        { key: 'companies', label: 'With Company', value: tasks.filter((t) => parseEnquiryDescription(t.description).company).length },
      ];
    }

    if (folder === 'unsubscribed') {
      const allPeople = await Contact.countDocuments(CUSTOMER_ROLE_MATCH).setOptions(CONTACT_BYPASS);
      const [byReason, byInlet, recentUnsubs] = await Promise.all([
        Contact.aggregate([{ $match: query }, { $group: { _id: '$unsubscribeReason', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
        Contact.aggregate([
          { $match: query },
          { $unwind: '$inlets' },
          { $group: { _id: '$inlets.key', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Contact.countDocuments({ ...query, updatedAt: { $gte: weekAgo } }).setOptions(CONTACT_BYPASS),
      ]);
      result.byReason = byReason;
      result.byInlet = byInlet.map((r) => ({ label: DATA_INLETS[r._id]?.label || r._id, count: r.count }));
      result.kpis = [
        { key: 'total', label: 'Unsubscribed', value: total },
        { key: 'recent', label: 'Updated This Week', value: recentUnsubs },
        { key: 'reasons', label: 'Distinct Reasons', value: byReason.filter((r) => r._id).length },
        {
          key: 'rate',
          label: '% of All People',
          value: allPeople ? Math.round((total / allPeople) * 100) : 0,
          format: 'percent',
        },
      ];
    }

    if (folder === 'mail') {
      const mailStats = await MailEvent.aggregate([
        { $group: { _id: '$eventType', count: { $sum: 1 } } },
      ]);
      const sends = mailStats.find((s) => s._id === 'Send')?.count || 0;
      const opens = mailStats.find((s) => s._id === 'Open')?.count || 0;
      const clicks = mailStats.find((s) => s._id === 'Click')?.count || 0;
      const bounces = mailStats.find((s) => s._id === 'Bounce')?.count || 0;
      const uniqueEmails = await MailEvent.distinct('email');
      result.mailStats = mailStats;
      result.kpis = [
        { key: 'engaged', label: 'Engaged People', value: total },
        { key: 'uniqueEmails', label: 'Unique Emails', value: uniqueEmails.filter(Boolean).length },
        { key: 'openRate', label: 'Open Rate', value: sends ? Math.round((opens / sends) * 100) : 0, format: 'percent' },
        { key: 'clickRate', label: 'Click Rate', value: sends ? Math.round((clicks / sends) * 100) : 0, format: 'percent' },
      ];
      result.rates = { sends, opens, clicks, bounces };
    }

    if (folder === 'community') {
      const [exlyCommunity, tscCommunity] = await Promise.all([
        ExlyBooking.countDocuments({ offeringTitle: { $regex: /community/i } }),
        TscData.countDocuments({
          $or: [
            { campaign: { $regex: /community/i } },
            { originSource: { $regex: /community/i } },
          ],
        }),
      ]);
      result.kpis = [
        { key: 'people', label: 'Community People', value: total },
        { key: 'exly', label: 'Exly Community Bookings', value: exlyCommunity },
        { key: 'tsc', label: 'TSC Community Rows', value: tscCommunity },
        { key: 'combined', label: 'Combined Records', value: exlyCommunity + tscCommunity },
      ];
      result.topOfferings = await ExlyBooking.aggregate([
        { $match: { offeringTitle: { $regex: /community/i } } },
        { $group: { _id: '$offeringTitle', count: { $sum: 1 }, revenue: { $sum: '$pricePaid' } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]);
    }

    if (folder === 'active') {
      const [inMailer, inExly, inCRM, multiInlet] = await Promise.all([
        Contact.countDocuments({ ...query, inMailer: true }).setOptions(CONTACT_BYPASS),
        Contact.countDocuments({ ...query, inExly: true }).setOptions(CONTACT_BYPASS),
        Contact.countDocuments({ ...query, inCRM: true }).setOptions(CONTACT_BYPASS),
        Contact.countDocuments({ ...query, isMultiInlet: true }).setOptions(CONTACT_BYPASS),
      ]);
      result.engagementFlags = [
        { label: 'Mail Engagement', count: inMailer },
        { label: 'Exly Purchases', count: inExly },
        { label: 'In CRM', count: inCRM },
        { label: 'Multi-Inlet', count: multiInlet },
      ];
      result.kpis = [
        { key: 'active', label: 'Active People', value: total },
        { key: 'mail', label: 'Mail Active', value: inMailer },
        { key: 'exly', label: 'Exly Active', value: inExly },
        { key: 'crm', label: 'CRM Active', value: inCRM },
      ];
    }

    // Default KPI if folder had none
    if (!result.kpis.length) {
      result.kpis = [{ key: 'total', label: 'In Folder', value: total }];
    }

    return result;
  }

  async getOverlapMatrix() {
    const multi = await Contact.find({ isMultiInlet: true }).setOptions(CONTACT_BYPASS).select('inlets').lean();
    const pairCounts = {};

    for (const c of multi) {
      const keys = [...new Set((c.inlets || []).map((i) => i.key))].sort();
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          const pair = `${keys[i]}+${keys[j]}`;
          pairCounts[pair] = (pairCounts[pair] || 0) + 1;
        }
      }
    }

    return Object.entries(pairCounts)
      .map(([pair, count]) => {
        const [a, b] = pair.split('+');
        return {
          a,
          b,
          labelA: DATA_INLETS[a]?.label || a,
          labelB: DATA_INLETS[b]?.label || b,
          count,
        };
      })
      .sort((x, y) => y.count - x.count);
  }

  async getSyncState() {
    let state = await DataHubSyncState.findOne({ configKey: 'incremental' });
    if (!state) {
      state = await DataHubSyncState.create({ configKey: 'incremental' });
    }
    return state;
  }

  /**
   * Sync only new/changed records into Contact hub (default).
   * Pass { full: true } to re-merge everything (one-off / script).
   */
  async syncAllInlets({ incremental = true, onProgress, full = false } = {}) {
    const syncStartedAt = new Date();
    const state = await this.getSyncState();
    let since = null;

    if (incremental && !full) {
      since = state.lastSyncedAt
        ? new Date(state.lastSyncedAt)
        : new Date(Date.now() - INCREMENTAL_BOOTSTRAP_MS);
    }

    const stats = await this._runInletMerge({ since, onProgress, full: !incremental || full });
    const repairedInlets = await this.repairDuplicateInlets({ onProgress });
    if (repairedInlets) stats.repairedInlets = repairedInlets;

    await DataHubSyncState.findOneAndUpdate(
      { configKey: 'incremental' },
      {
        $set: {
          lastSyncedAt: syncStartedAt,
          lastStats: stats,
          ...(full ? { lastFullSyncAt: syncStartedAt } : {}),
        },
      },
      { upsert: true }
    );

    this.clearFolderCache();
    return { ...stats, incremental: incremental && !full, since: since?.toISOString() || null, syncedAt: syncStartedAt };
  }

  /** @deprecated Use syncAllInlets */
  async reconcileAll(opts = {}) {
    return this.syncAllInlets({ ...opts, full: opts.full ?? false, incremental: opts.full ? false : true });
  }

  async _runInletMerge({ since, onProgress, full = false }) {
    const stats = { leads: 0, tsc: 0, exly: 0, enquiries: 0, mail: 0, bookedCalls: 0, errors: 0 };
    const BATCH = 100;
    const log = (msg) => {
      if (onProgress) onProgress(msg);
    };

    // Booked calls: CRM only (website webhook → Lead). No sheet import.
    log('booked_calls: CRM webhook only (sheet sync removed)');

    const runBatch = async (items, label, handler) => {
      if (!items.length) return;
      log(`${label}: merging ${items.length} records…`);
      for (let i = 0; i < items.length; i += BATCH) {
        const batch = items.slice(i, i + BATCH);
        if (i === 0 || (i + BATCH) % 500 === 0 || i + BATCH >= items.length) {
          log(`${label}: ${Math.min(i + BATCH, items.length)}/${items.length}`);
        }
        await Promise.all(batch.map(async (item) => {
          try {
            await handler(item);
          } catch {
            stats.errors += 1;
          }
        }));
      }
    };

    const leadFilter = since ? changedSince(since) : {};
    const leads = await Lead.find(leadFilter).lean();
    log(`leads: loaded ${leads.length} for merge`);
    await runBatch(leads, 'leads', async (lead) => {
      if (!lead.email && !lead.phone) return;
      const inletKey = isBookedCallSource(lead.source) ? 'booked_calls' : 'leads';
      await ContactService.mergeContact({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        city: lead.city,
        leadStatus: lead.leadStatus,
        leadQuality: lead.leadQuality,
        emailStatus: lead.emailStatus,
        unsubscribed: lead.unsubscribed,
        unsubscribeReason: lead.unsubscribeReason,
        recordId: lead._id,
        summary: {
          source: lead.source,
          leadStatus: lead.leadStatus,
          callStatus: lead.callStatus,
          nextFollowupDate: lead.nextFollowupDate,
          nextFollowupTime: lead.nextFollowupTime,
        },
        inletKey,
      }, inletKey === 'booked_calls' ? 'booked_calls' : 'crm');
      stats.leads += 1;
    });

    const tscRows = await TscData.find(since ? changedSince(since) : {}).lean();
    log(`tsc: loaded ${tscRows.length} for merge`);
    await runBatch(tscRows, 'tsc', async (row) => {
      if (!row.email && !row.phone) return;
      const isCommunity = isCommunityText(row.campaign) || isCommunityText(row.originSource);
      const inletKey = isCommunity ? 'community' : 'tsc';
      await ContactService.mergeContact({
        name: row.name,
        email: row.email,
        phone: row.phone,
        city: row.city,
        sourceFilename: row.sourceFilename,
        emailStatus: row.emailStatus,
        recordId: row._id,
        summary: { campaign: row.campaign, originSource: row.originSource, role: row.role },
        inletKey,
      }, inletKey);
      stats.tsc += 1;
    });

    const bookings = await ExlyBooking.find(since ? changedSince(since) : {}).lean();
    await runBatch(bookings, 'exly', async (booking) => {
      if (!booking.email && !booking.phone) return;
      const isCommunity = isCommunityText(booking.offeringTitle);
      const inletKey = isCommunity ? 'community' : 'exly';
      await ContactService.mergeContact({
        name: booking.name,
        email: booking.email,
        phone: booking.phone,
        exlyOfferingTitle: booking.offeringTitle,
        emailStatus: booking.emailStatus,
        unsubscribed: booking.unsubscribed,
        recordId: booking._id,
        summary: { offeringTitle: booking.offeringTitle, pricePaid: booking.pricePaid },
        inletKey,
      }, inletKey);
      stats.exly += 1;
    });

    const taskFilter = { type: 'enquiry', ...(since ? changedSince(since) : {}) };
    const tasks = await Task.find(taskFilter).select('description _id').lean();
    await runBatch(tasks, 'enquiries', async (task) => {
      const parsed = parseEnquiryDescription(task.description);
      if (!parsed.email && !parsed.phone) return;
      await ContactService.mergeContact({
        name: parsed.name,
        email: parsed.email,
        phone: parsed.phone,
        recordId: task._id,
        summary: { artist: parsed.artist, company: parsed.company, collaborationType: parsed.collaborationType },
        inletKey: 'enquiries',
      }, 'enquiries');
      stats.enquiries += 1;
    });

    let mailEmails = [];
    if (since) {
      mailEmails = await MailEvent.distinct('email', { timestamp: { $gte: since } });
    } else {
      mailEmails = await MailEvent.distinct('email');
    }
    const validEmails = mailEmails.filter(Boolean);
    await runBatch(validEmails, 'mail', async (email) => {
      await ContactService.mergeContact({
        name: 'Anonymous',
        email,
        inletKey: 'mail',
        summary: { mailEventCount: 1 },
      }, 'mailer');
      stats.mail += 1;
    });

    return stats;
  }

  clearFolderCache() {
    folderCache = { data: null, expiresAt: 0 };
  }

  async repairDuplicateInlets({ onProgress } = {}) {
    const contacts = await Contact.find({ inlets: { $exists: true, $not: { $size: 0 } } })
      .setOptions(CONTACT_BYPASS)
      .select('inlets')
      .lean();
    let fixed = 0;
    for (const contact of contacts) {
      const deduped = dedupeInletEntries(contact.inlets || []);
      if (deduped.length === (contact.inlets || []).length) continue;
      await Contact.updateOne(
        { _id: contact._id },
        {
          $set: {
            inlets: deduped,
            inletCount: deduped.length,
            isMultiInlet: deduped.length >= 2,
          },
        }
      ).setOptions(CONTACT_BYPASS);
      fixed += 1;
    }
    if (fixed && onProgress) onProgress(`repaired duplicate inlets on ${fixed} contacts`);
    return fixed;
  }

  clearFolderCache() {
    folderCache = { data: null, expiresAt: 0 };
  }
}

function identityMatchFromContacts(_query) {
  return null;
}

module.exports = new DataHubService();