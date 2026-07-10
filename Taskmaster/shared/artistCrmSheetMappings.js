const { CONTACT_CATEGORIES, ARTIST_PROJECTS, IMPORT_TAGS } = require('./artistCrmTaxonomy');

/**
 * Detect sheet template from filename and return import config.
 * @param {string} filename
 */
function detectSheetTemplate(filename) {
  const name = String(filename || '').toLowerCase();

  if (name.includes('yugm') && name.includes('media')) {
    return {
      id: 'yugm_media',
      label: 'YUGM Media List',
      artistProject: ARTIST_PROJECTS.YUGM,
      contactCategory: CONTACT_CATEGORIES.PRESS_MEDIA,
      tags: [IMPORT_TAGS.PRESS_RELEASE, IMPORT_TAGS.MEDIA_LIST, IMPORT_TAGS.YUGM],
      type: 'yugm_media',
    };
  }

  if (name.includes('harsha') && name.includes('media')) {
    const region = name.includes('pune') ? 'Pune' : name.includes('nashik') ? 'Nashik' : '';
    return {
      id: 'hd_media',
      label: `Harshad Duhita Media List${region ? ` (${region})` : ''}`,
      artistProject: ARTIST_PROJECTS.HARSHAD_DUHITA,
      contactCategory: CONTACT_CATEGORIES.PRESS_MEDIA,
      tags: [IMPORT_TAGS.PRESS_RELEASE, IMPORT_TAGS.MEDIA_LIST, IMPORT_TAGS.HARSHAD_DUHITA],
      type: region === 'Pune' ? 'hd_pune_media' : region === 'Nashik' ? 'hd_nashik_media' : 'hd_media',
      region,
    };
  }

  if (name.includes('harsha') && (name.includes('events') || name.includes('fests'))) {
    return {
      id: 'hd_events',
      label: 'Harshad Duhita Events & Fests',
      artistProject: ARTIST_PROJECTS.HARSHAD_DUHITA,
      contactCategory: CONTACT_CATEGORIES.EVENT_ORGANIZER,
      tags: [IMPORT_TAGS.HARSHAD_DUHITA],
      type: 'hd_events',
    };
  }

  if (name.includes('harsha') && (name.includes('wavr') || name.includes('warkari'))) {
    return {
      id: 'hd_warkari',
      label: 'Harshad Duhita Warkari Contacts',
      artistProject: ARTIST_PROJECTS.HARSHAD_DUHITA,
      contactCategory: CONTACT_CATEGORIES.EVENT_ORGANIZER,
      tags: [IMPORT_TAGS.WARKARI, IMPORT_TAGS.HARSHAD_DUHITA],
      type: 'hd_warkari',
    };
  }

  if (name.includes('event database') || name.includes('artist event database')) {
    return {
      id: 'event_database',
      label: 'TSC Artist Event Database',
      artistProject: null,
      contactCategory: CONTACT_CATEGORIES.EVENT_DATABASE,
      tags: [IMPORT_TAGS.EVENT_DB],
      type: 'event_database',
    };
  }

  return null;
}

function listSheetTemplates() {
  return [
    detectSheetTemplate('YUGM __ TSC Artist Mastersheet - Media List.csv'),
    detectSheetTemplate('harshaDuhita Collective __ TSC Talent Mastersheet - Pune Media List.csv'),
    detectSheetTemplate('harshaDuhita Collective __ TSC Talent Mastersheet - Nashik Media List.csv'),
    detectSheetTemplate('harshaDuhita Collective __ TSC Talent Mastersheet - events _ fests.csv'),
    detectSheetTemplate('harshaDuhita Collective __ TSC Talent Mastersheet - Wavrkari sanstha and maharaj contact.csv'),
    detectSheetTemplate('TSC Artist Event Database - Master Database.csv'),
  ].filter(Boolean);
}

module.exports = {
  detectSheetTemplate,
  listSheetTemplates,
};
