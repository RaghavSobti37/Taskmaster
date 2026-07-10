const { ARTIST_PROJECTS } = require('./artistCrmTaxonomy');

/**
 * Detect Instagram analytics mastersheet from filename.
 * @param {string} filename
 */
function detectAnalyticsSheetTemplate(filename) {
  const name = String(filename || '').toLowerCase();
  if (!name.includes('analytics')) return null;

  if (name.includes('yugm')) {
    return {
      id: 'yugm_analytics',
      label: 'YUGM Instagram Analytics',
      artistNames: ['YUGM', 'Yugm'],
      artistProject: ARTIST_PROJECTS.YUGM,
    };
  }

  if (name.includes('harsha') || name.includes('duhita')) {
    return {
      id: 'hd_analytics',
      label: 'Harshad & Duhita Instagram Analytics',
      artistNames: ['Harshad & Duhita', 'Harshad Duhita', 'Harshad and Duhita'],
      artistProject: ARTIST_PROJECTS.HARSHAD_DUHITA,
    };
  }

  return null;
}

module.exports = {
  detectAnalyticsSheetTemplate,
};
