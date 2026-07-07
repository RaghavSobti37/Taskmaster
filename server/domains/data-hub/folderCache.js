const PersonIndex = require('../../models/PersonIndex');
const PersonHubView = require('../../models/PersonHubView');
const { bypassOptions } = require('../../infrastructure/database/bypassTenantPolicy');

const FOLDER_CACHE_TTL_MS = 5 * 60 * 1000;
const HUB_MODEL_RESOLVE_TTL_MS = 30 * 1000;
const CONTACT_BYPASS = bypassOptions('data_hub');

const HUB_SOURCE_TO_FOLDER = {
  lead: 'leads',
  exly_booking: 'exly',
  outsourced: 'outsourced',
  booked_call: 'booked_calls',
  newsletter: 'newsletter',
  artist_path: 'artist_path',
  artist_crm: 'artist_crm',
  mail: 'mail',
  enquiry: 'enquiries',
  community: 'community',
  havells_registered: 'havells_registered',
  havells_selected: 'havells_selected',
  havells_attended_delhi: 'havells_attended_delhi',
  havells_attended_indore: 'havells_attended_indore',
  havells_attended_dumka: 'havells_attended_dumka',
};
const HUB_KEY_TO_FOLDER = { ...HUB_SOURCE_TO_FOLDER };

let folderCache = { data: null, expiresAt: 0 };
let hubModelResolution = { useHubView: false, expiresAt: 0 };
let hubViewActive = false;

function mapHubInletKey(hubKey) {
  return HUB_SOURCE_TO_FOLDER[hubKey] || hubKey;
}

async function resolveHubModel() {
  const now = Date.now();
  if (hubModelResolution.expiresAt > now) {
    hubViewActive = hubModelResolution.useHubView;
    return hubViewActive ? PersonHubView : PersonIndex;
  }

  const [hubCount, indexCount, hubWithInlets] = await Promise.all([
    PersonHubView.countDocuments({}).setOptions(CONTACT_BYPASS),
    PersonIndex.countDocuments({}).setOptions(CONTACT_BYPASS),
    PersonHubView.countDocuments({
      $or: [
        { inletCount: { $gte: 1 } },
        { inCRM: true },
        { inExly: true },
        { inOutsourced: true },
        { inMailer: true },
        { inBookedCalls: true },
        { inNewsletter: true },
        { inArtistPath: true },
        { inArtistCrm: true },
        { inEnquiries: true },
      ],
    }).setOptions(CONTACT_BYPASS),
  ]);

  const useHubView = hubCount > 0 && (
    indexCount === 0
    || hubCount >= indexCount * 0.9
    || hubWithInlets >= Math.max(indexCount, hubCount) * 0.5
  );
  hubViewActive = useHubView;
  hubModelResolution = { useHubView, expiresAt: now + HUB_MODEL_RESOLVE_TTL_MS };
  return useHubView ? PersonHubView : PersonIndex;
}

function resetHubModelCache() {
  hubModelResolution = { useHubView: false, expiresAt: 0 };
  hubViewActive = false;
}

function getFolderCache() {
  return folderCache;
}

function setFolderCache(data) {
  folderCache = { data, expiresAt: Date.now() + FOLDER_CACHE_TTL_MS };
}

function clearFolderCache() {
  folderCache = { data: null, expiresAt: 0 };
  resetHubModelCache();
}

function isHubViewActive() {
  return hubViewActive;
}

module.exports = {
  FOLDER_CACHE_TTL_MS,
  HUB_SOURCE_TO_FOLDER,
  HUB_KEY_TO_FOLDER,
  CONTACT_BYPASS,
  mapHubInletKey,
  resolveHubModel,
  resetHubModelCache,
  getFolderCache,
  setFolderCache,
  clearFolderCache,
  isHubViewActive,
};
