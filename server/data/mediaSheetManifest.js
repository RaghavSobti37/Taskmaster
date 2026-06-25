const path = require('path');

const SHEETS_DIR = path.join(__dirname, 'media-sheets');

/** @type {import('../services/mediaListImportService').MediaSheetConfig[]} */
const MEDIA_SHEETS = [
  { name: 'TSC Media List', file: 'TSC_Media_List.csv', mapper: 'standardMedia' },
  { name: 'TSC Podcasts', file: 'TSC_Podcasts.csv', mapper: 'podcasts' },
  { name: 'Social Media Agency Info', file: 'Social_Media_Agency_Info.csv', mapper: 'agency' },
  { name: 'Platforms, Festivals & Hubs', file: 'Platforms_Festivals_Hubs.csv', mapper: 'events' },
  { name: 'Music Updated', file: 'Music_Updated.csv', mapper: 'musicSimple' },
  { name: 'Music Media', file: 'Music_Media.csv', mapper: 'musicSimple' },
  { name: 'Consumer', file: 'Consumer.csv', mapper: 'consumer' },
  { name: 'Education', file: 'Education.csv', mapper: 'education' },
  { name: 'Business & AnM', file: 'Business_AnM.csv', mapper: 'musicSimple' },
  { name: 'A&MNashik Media', file: 'A_MNashik_Media.csv', mapper: 'standardMedia' },
  { name: 'Online / New Age Media', file: 'Online_New_Age_Media.csv', mapper: 'positionalPubNamePhoneEmail' },
  { name: 'Indore Media', file: 'Indore_Media.csv', mapper: 'indore' },
  { name: 'Regional Media', file: 'Regional_Media.csv', mapper: 'positionalPubNamePhoneEmail' },
  { name: 'YouTube Reviewers', file: 'YouTube_Reviewers.csv', mapper: 'youtube' },
  { name: 'Fashion & Lifestyle Mag', file: 'Fashion_Lifestyle_Mag.csv', mapper: 'positionalPubNamePhoneEmail' },
  { name: 'City & General', file: 'City_General.csv', mapper: 'cityGeneral' },
  { name: 'CEO Profiling', file: 'CEO_Profiling.csv', mapper: 'ceoProfiling' },
];

function sheetFilePath(sheet) {
  return path.join(SHEETS_DIR, sheet.file);
}

module.exports = {
  SHEETS_DIR,
  MEDIA_SHEETS,
  sheetFilePath,
};
