const MasterclassReview = require('../models/MasterclassReview');
const PersonIdentityService = require('./PersonIdentityService');
const ContactService = require('./ContactService');
const { sanitizeEmail } = require('../utils/sanitizer');

const RATING_LABELS = {
  5: 'Excellent',
  4: 'Very Good',
  3: 'Good',
  2: 'Fair',
  1: 'Needs Work',
};

function normalizeCampaign(value) {
  const v = String(value || 'review01').trim().toLowerCase();
  if (v === 'review02') return 'review02';
  return 'review01';
}

async function processMasterclassReviewWebhook(data = {}) {
  const campaign = normalizeCampaign(data.campaign);
  const {
    firstName,
    lastName,
    registeredMobile,
    registeredEmail,
    artistTypes,
    completion,
    pace,
    clarity,
    depth,
    usefulness,
    courseInterest,
    weightedRating,
    oneLineExperience,
    improvementSuggestion,
    name,
    title,
    content,
    rating,
  } = data;

  if (!firstName || !lastName || !registeredMobile || !registeredEmail || !oneLineExperience || !improvementSuggestion) {
    throw new Error('Missing required fields');
  }

  const numericRating = parseInt(String(rating || '5'), 10) || 5;
  const finalWeightedRating = Number(parseFloat(String(weightedRating || numericRating)).toFixed(2));
  const ratingText = RATING_LABELS[Math.max(1, Math.min(5, Math.round(numericRating)))] || 'Good';
  const displayName = name || `${firstName} ${lastName}`.trim();
  const email = sanitizeEmail(registeredEmail);

  const resolved = await PersonIdentityService.resolvePerson(
    { name: displayName, email, phone: registeredMobile },
    { source: 'masterclass_review' }
  );

  const review = await MasterclassReview.create({
    personId: resolved?.personId,
    name: displayName,
    email,
    phone: registeredMobile,
    campaign,
    firstName,
    lastName,
    registeredMobile,
    registeredEmail: email,
    artistTypes: Array.isArray(artistTypes) ? artistTypes.join(', ') : String(artistTypes || ''),
    completion: completion || '',
    pace: pace || '',
    clarity: clarity || '',
    depth: depth || '',
    usefulness: usefulness || '',
    courseInterest: courseInterest || '',
    weightedRating: finalWeightedRating,
    oneLineExperience: oneLineExperience || '',
    improvementSuggestion: improvementSuggestion || '',
    displayName,
    title: title || 'Masterclass Review',
    content: content || oneLineExperience || '',
    rating: finalWeightedRating,
    ratingText,
    isApproved: false,
    source: data.source || 'tsc-website',
    sourceSite: data.sourceSite || 'tsc-website',
    submittedAt: new Date(),
  });

  if (resolved?.personId) {
    await PersonIdentityService.linkSource(resolved.personId, 'masterclass_review', review._id, {
      campaign,
      rating: finalWeightedRating,
    });
    await ContactService.mergeContact({
      name: displayName,
      email,
      phone: registeredMobile,
      recordId: review._id,
      summary: { campaign, rating: finalWeightedRating },
      inletKey: 'community',
    }, 'community');
  }

  return { success: true, reviewId: review._id };
}

function computeStats(reviews) {
  const totalCount = reviews.length;
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let sumRating = 0;

  reviews.forEach((item) => {
    const rate = Math.max(1, Math.min(5, Math.round(item.rating || item.weightedRating || 5)));
    if (distribution[rate] !== undefined) {
      distribution[rate] += 1;
      sumRating += item.rating || item.weightedRating || 5;
    }
  });

  const average = totalCount > 0 ? (sumRating / totalCount).toFixed(1) : '5.0';

  return {
    average,
    distribution: [
      { stars: 5, count: distribution[5] },
      { stars: 4, count: distribution[4] },
      { stars: 3, count: distribution[3] },
      { stars: 2, count: distribution[2] },
      { stars: 1, count: distribution[1] },
    ],
  };
}

async function listPublicMasterclassReviews(campaignParam) {
  const campaign = normalizeCampaign(campaignParam);
  const allReviews = await MasterclassReview.find({ campaign }).sort({ submittedAt: -1 }).lean();
  const approved = allReviews.filter((r) => r.isApproved);

  const reviews = approved.map((row, index) => ({
    id: index + 1,
    date: row.submittedAt ? new Date(row.submittedAt).toISOString() : '',
    name: row.displayName || row.name || `${row.firstName || ''} ${row.lastName || ''}`.trim() || 'Anonymous',
    title: row.title || 'Masterclass Review',
    content: row.oneLineExperience || row.content || row.improvementSuggestion || '',
    rating: row.weightedRating || row.rating || 5,
    completion: row.completion || '',
    artistTypes: row.artistTypes || '',
    isApproved: true,
  }));

  return {
    success: true,
    count: reviews.length,
    totalCount: allReviews.length,
    reviews,
    stats: computeStats(allReviews),
  };
}

async function approveMasterclassReview(reviewId) {
  const review = await MasterclassReview.findByIdAndUpdate(
    reviewId,
    { $set: { isApproved: true } },
    { new: true }
  );
  if (!review) throw new Error('Review not found');
  return review;
}

module.exports = {
  processMasterclassReviewWebhook,
  listPublicMasterclassReviews,
  approveMasterclassReview,
};
