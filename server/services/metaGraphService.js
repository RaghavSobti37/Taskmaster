/**
 * Meta / Instagram Graph API helpers.
 * Uses page access tokens — user tokens alone cannot read IG business accounts.
 */
const axios = require('axios');
const logger = require('../utils/logger');

const GRAPH = 'https://graph.facebook.com/v21.0';

async function getPageAccessToken(pageId, userToken) {
  if (!pageId || !userToken) return null;
  try {
    const { data } = await axios.get(`${GRAPH}/${pageId}`, {
      params: { fields: 'access_token,name', access_token: userToken },
      timeout: 8000,
    });
    return { pageToken: data.access_token || userToken, pageName: data.name };
  } catch (err) {
    logger.warn('metaGraph', 'Page token fetch failed', { error: err?.response?.data?.error?.message || err.message });
    return { pageToken: userToken, pageName: null };
  }
}

async function resolveInstagramAccount(fbPageId, userToken) {
  if (!fbPageId || !userToken) return null;
  try {
    const { data } = await axios.get(`${GRAPH}/${fbPageId}`, {
      params: { fields: 'instagram_business_account{id,username,name,profile_picture_url,followers_count}', access_token: userToken },
      timeout: 8000,
    });
    const ig = data?.instagram_business_account;
    if (!ig?.id) return null;
    return {
      igAccountId: ig.id,
      igUsername: ig.username,
      igName: ig.name,
      followers: ig.followers_count,
      profilePicture: ig.profile_picture_url,
    };
  } catch (err) {
    logger.warn('metaGraph', 'IG account resolve failed', { error: err?.response?.data?.error?.message || err.message });
    return null;
  }
}

async function fetchMetaAnalytics(meta = {}) {
  const userToken = meta.accessToken || process.env.META_USER_TOKEN || null;
  const fbPageId = meta.fbPageId || process.env.META_DEFAULT_PAGE_ID || null;
  let igAccountId = meta.igAccountId || null;
  let igUsername = meta.igUsername || null;

  if (!userToken) {
    logger.info('metaGraph', 'No access token — connect Instagram via OAuth');
    return null;
  }

  let pageToken = userToken;
  let pageName = meta.fbPageName || '';

  if (fbPageId) {
    const pageCtx = await getPageAccessToken(fbPageId, userToken);
    if (pageCtx?.pageToken) pageToken = pageCtx.pageToken;
    if (pageCtx?.pageName) pageName = pageCtx.pageName;
  }

  // Resolve or refresh IG account from linked Facebook Page
  if (fbPageId) {
    const resolved = await resolveInstagramAccount(fbPageId, userToken);
    if (resolved) {
      igAccountId = resolved.igAccountId;
      igUsername = resolved.igUsername || igUsername;
    }
  }

  let followersCount = null;
  let mediaData = { data: [] };
  let facebookData = null;

  if (igAccountId) {
    try {
      const { data } = await axios.get(`${GRAPH}/${igAccountId}`, {
        params: {
          fields: 'followers_count,username,name,media.limit(12){id,caption,media_type,like_count,comments_count,permalink,timestamp}',
          access_token: pageToken,
        },
        timeout: 12000,
      });
      if (data.followers_count != null) followersCount = data.followers_count;
      if (data.username) igUsername = data.username;
      if (data.media?.data) mediaData = { data: data.media.data };
      logger.info('metaGraph', `Instagram @${igUsername || igAccountId} | Followers: ${followersCount ?? 'N/A'}`);
    } catch (err) {
      const msg = err?.response?.data?.error?.message || err.message;
      logger.error('❌ [Meta] Instagram profile error:', msg);
      // ID may be stale — try resolve again
      if (fbPageId) {
        const resolved = await resolveInstagramAccount(fbPageId, userToken);
        if (resolved?.igAccountId && resolved.igAccountId !== igAccountId) {
          igAccountId = resolved.igAccountId;
          igUsername = resolved.igUsername;
          try {
            const { data } = await axios.get(`${GRAPH}/${igAccountId}`, {
              params: { fields: 'followers_count,username,media.limit(12){id,caption,media_type,like_count,comments_count,permalink}', access_token: pageToken },
              timeout: 12000,
            });
            followersCount = data.followers_count ?? null;
            mediaData = { data: data.media?.data || [] };
          } catch (retryErr) {
            logger.error('❌ [Meta] Instagram retry failed:', retryErr?.response?.data?.error?.message || retryErr.message);
          }
        }
      }
    }
  }

  if (fbPageId) {
    try {
      const { data } = await axios.get(`${GRAPH}/${fbPageId}`, {
        params: { fields: 'fan_count,followers_count,name,link', access_token: pageToken },
        timeout: 8000,
      });
      facebookData = {
        likes: data.fan_count ?? 0,
        followers: data.followers_count ?? 0,
        name: data.name || pageName,
        link: data.link || `https://www.facebook.com/${fbPageId}`,
      };
      logger.info('metaGraph', `Facebook Page: ${facebookData.name} | Followers: ${facebookData.followers}`);
    } catch (err) {
      logger.error('❌ [Meta] Facebook Page error:', err?.response?.data?.error || err.message);
    }
  }

  return {
    media: mediaData,
    followers: followersCount,
    facebook: facebookData,
    igAccountId,
    igUsername,
  };
}

module.exports = { fetchMetaAnalytics, resolveInstagramAccount, getPageAccessToken };
