/** Artist CRM contact categories and tag constants. */

const CONTACT_CATEGORIES = {
  PRESS_MEDIA: 'press_media',
  EVENT_ORGANIZER: 'event_organizer',
  EVENT_DATABASE: 'event_database',
  BOOKING_ENQUIRY: 'booking_enquiry',
};

const CRM_TYPES = {
  SALES: 'sales',
  ARTIST: 'artist',
};

const ARTIST_PROJECTS = {
  YUGM: 'YUGM',
  HARSHAD_DUHITA: 'Harshad Duhita',
};

const IMPORT_TAGS = {
  PRESS_RELEASE: 'press-release',
  MEDIA_LIST: 'media-list',
  EVENT_DB: 'event-db',
  WARKARI: 'warkari',
  YUGM: 'yugm',
  HARSHAD_DUHITA: 'harshad-duhita',
};

/** Slugify Event DB category column for tag filter. */
function categoryToTagSlug(category) {
  return String(category || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

module.exports = {
  CONTACT_CATEGORIES,
  CRM_TYPES,
  ARTIST_PROJECTS,
  IMPORT_TAGS,
  categoryToTagSlug,
};
