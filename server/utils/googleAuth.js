const { google } = require('googleapis');

const createOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

const getCalendar = (auth) => {
  return google.calendar({ version: 'v3', auth });
};

const getDrive = (auth) => {
  return google.drive({ version: 'v3', auth });
};

module.exports = {
  createOAuth2Client,
  getCalendar,
  getDrive
};
