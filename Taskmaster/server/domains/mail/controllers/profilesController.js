const EmailProfile = require('../models/EmailProfile');
const { isAdminUser } = require('../../../utils/departmentPermissions');
const { getDailyLimitForProvider, FREE_ROTATION_PROVIDER_KEYS } = require('../../../utils/smtpPresets');
const { mergeProviderCredentials } = require('../../../utils/profileCredentials');
const {
  getTodaySendCountsByProfileProvider,
  syncProviderUsageFromEvents,
  buildProfileUsage,
} = require('../../../services/profileSendStats');

exports.getSmtpUsage = async (req, res) => {
  try {
    const filter = isAdminUser(req.user) ? {} : { createdBy: req.user._id };
    await syncProviderUsageFromEvents();
    const todayCounts = await getTodaySendCountsByProfileProvider();
    const profiles = await EmailProfile.find(filter)
      .select('-smtpPass -providerCredentials')
      .lean();
    const usage = profiles.flatMap((p) => {
      const u = buildProfileUsage(p, todayCounts);
      if (u.rotation?.providers?.length) {
        return u.rotation.providers.map((prov) => ({
          profileId: p._id,
          profileName: p.name,
          email: p.email,
          providerKey: prov.providerKey,
          label: prov.label,
          smtpHost: prov.smtpHost,
          used: prov.used,
          limit: prov.limit,
          total: prov.total,
          percent: prov.percent,
          resetAt: prov.resetAt,
          resetLabel: u.resetLabel,
        }));
      }
      return [{
        profileId: p._id,
        profileName: p.name,
        email: p.email,
        providerKey: p.providerType || 'custom',
        label: p.providerType || 'custom',
        used: u.used,
        limit: u.limit,
        total: u.total,
        percent: u.percent,
        resetAt: u.resetAt,
        resetLabel: u.resetLabel,
      }];
    });
    res.json(usage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.list = async (req, res) => {
  try {
    const filter = isAdminUser(req.user) ? {} : { createdBy: req.user._id };
    const todayCounts = await getTodaySendCountsByProfileProvider();
    const profiles = await EmailProfile.find(filter)
      .select('-smtpPass -providerCredentials')
      .lean();
    const enriched = profiles.map((p) => ({
      ...p,
      rotationProviderCount: FREE_ROTATION_PROVIDER_KEYS.length,
      usage: buildProfileUsage(p, todayCounts),
    }));
    res.json(enriched);
  } catch (err) {
    console.error('Get profiles error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const data = { ...req.body };
    if (!data.name?.trim() || !data.email?.trim()) {
      return res.status(400).json({ error: 'Profile name and From email are required.' });
    }
    const hasPrimary = data.smtpUser?.trim() && data.smtpPass?.trim();
    const hasExtra = data.providerCredentials && Object.values(data.providerCredentials).some((c) => c?.enabled && c?.smtpPass?.trim());
    if (!hasPrimary && !hasExtra) {
      return res.status(400).json({ error: 'Primary SMTP credentials or at least one additional provider key is required.' });
    }
    if (!hasPrimary) {
      data.smtpUser = data.smtpUser?.trim() || data.email.trim();
      data.smtpPass = data.smtpPass?.trim() || 'unused';
    }
    if (data.rotationEnabled !== false) {
      data.rotationEnabled = true;
      data.providerType = 'rotation';
      data.smtpHost = 'rotation';
      data.smtpPort = 587;
    } else if (data.smtpHost && data.smtpHost.toLowerCase().trim() === 'gmail') {
      data.smtpHost = 'smtp.gmail.com';
      data.smtpPort = 587;
    }
    if (data.providerType && data.providerType !== 'rotation' && !data.dailyLimit) {
      data.dailyLimit = getDailyLimitForProvider(data.providerType);
    }
    if (data.providerCredentials) {
      data.providerCredentials = mergeProviderCredentials(new Map(), data.providerCredentials);
    }
    const profile = await EmailProfile.create({ ...data, createdBy: req.user._id });
    res.json(profile);
  } catch (err) {
    console.error('Create profile error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const profile = await EmailProfile.findById(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    if (!isAdminUser(req.user) && profile.createdBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to delete this profile' });
    }
    await EmailProfile.findByIdAndDelete(req.params.id);
    res.json({ message: 'Profile deleted' });
  } catch (err) {
    console.error('Delete profile error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const profile = await EmailProfile.findById(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    if (!isAdminUser(req.user) && profile.createdBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to edit this profile' });
    }
    const data = { ...req.body };
    if (data.rotationEnabled !== false) {
      data.rotationEnabled = true;
      data.providerType = 'rotation';
      data.smtpHost = 'rotation';
      data.smtpPort = 587;
    } else if (data.smtpHost && data.smtpHost.toLowerCase().trim() === 'gmail') {
      data.smtpHost = 'smtp.gmail.com';
      data.smtpPort = 587;
    }
    if (data.providerType && data.providerType !== 'rotation' && !data.dailyLimit) {
      data.dailyLimit = getDailyLimitForProvider(data.providerType);
    }
    if (!data.smtpPass) delete data.smtpPass;
    if (data.providerCredentials) {
      profile.providerCredentials = mergeProviderCredentials(profile.providerCredentials, data.providerCredentials);
      profile.markModified('providerCredentials');
      delete data.providerCredentials;
    }
    Object.assign(profile, data);
    await profile.save();
    res.json(profile);
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: err.message });
  }
};
