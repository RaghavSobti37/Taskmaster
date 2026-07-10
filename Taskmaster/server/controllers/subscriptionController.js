const Subscription = require('../models/Subscription');
const mongoose = require('mongoose');
const { getUsdInrRate } = require('../services/usdInrRateService');

const populateFields = (query) =>
  query
    .populate('usedBy', 'name email avatar')
    .populate('updatedBy', 'name email avatar');

const normalizeUsedByPayload = (usedBy) => {
  if (usedBy == null || usedBy === '') return [];
  const ids = Array.isArray(usedBy) ? usedBy : [usedBy];
  return ids.filter((id) => id && mongoose.Types.ObjectId.isValid(id));
};

const normalizeUsedByOnDoc = (subscription) => {
  if (!subscription) return subscription;
  if (subscription.usedBy != null && !Array.isArray(subscription.usedBy)) {
    subscription.usedBy = [subscription.usedBy];
  }
  return subscription;
};

const prepareBody = (body) => {
  const next = { ...body };
  if (Object.prototype.hasOwnProperty.call(body, 'usedBy')) {
    next.usedBy = normalizeUsedByPayload(body.usedBy);
  }
  return next;
};

exports.getUsdInrRate = async (req, res) => {
  try {
    const data = await getUsdInrRate();
    res.json(data);
  } catch (error) {
    res.status(503).json({ error: 'Unable to fetch USD/INR exchange rate' });
  }
};

exports.listSubscriptions = async (req, res) => {
  try {
    const subscriptions = await populateFields(
      Subscription.find().sort('dueDate')
    );
    res.json(subscriptions.map(normalizeUsedByOnDoc));
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching subscriptions' });
  }
};

exports.createSubscription = async (req, res) => {
  try {
    const subscription = new Subscription({
      ...prepareBody(req.body),
      updatedBy: req.user._id,
    });
    const saved = await subscription.save();
    const populated = await populateFields(Subscription.findById(saved._id));
    res.status(201).json(normalizeUsedByOnDoc(populated));
  } catch (error) {
    res.status(400).json({ error: 'Failed to create subscription' });
  }
};

exports.updateSubscription = async (req, res) => {
  try {
    const existing = await Subscription.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Subscription not found' });

    const updates = {
      ...prepareBody(req.body),
      updatedBy: req.user._id,
    };

    const dueDateChanged =
      req.body.dueDate &&
      new Date(req.body.dueDate).getTime() !== new Date(existing.dueDate).getTime();
    if (dueDateChanged) {
      updates.reminderSentForDueDate = null;
    }

    const updated = await populateFields(
      Subscription.findByIdAndUpdate(req.params.id, { $set: updates }, { returnDocument: 'after' })
    );
    res.json(normalizeUsedByOnDoc(updated));
  } catch (error) {
    res.status(400).json({ error: 'Failed to update subscription' });
  }
};

exports.deleteSubscription = async (req, res) => {
  try {
    const deleted = await Subscription.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ message: 'Subscription removed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete subscription' });
  }
};
