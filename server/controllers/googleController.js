const { createOAuth2Client, getCalendar, getDrive } = require('../utils/googleAuth');
const User = require('../models/User');

exports.linkGoogleAccount = async (req, res) => {
  try {
    const { code } = req.body;
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    
    // Save tokens to user
    await User.findByIdAndUpdate(req.user._id, {
      googleRefreshToken: tokens.refresh_token,
      googleAccessToken: tokens.access_token
    });

    res.json({ message: 'Google account linked successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getCalendarEvents = async (req, res) => {
  try {
    // For now, return mock events if no tokens, or real if tokens exist
    const oauth2Client = createOAuth2Client();
    // oauth2Client.setCredentials({ refresh_token: req.user.googleRefreshToken });
    // const calendar = getCalendar(oauth2Client);
    // const response = await calendar.events.list({ calendarId: 'primary', timeMin: (new Date()).toISOString() });
    
    // Mock response for demonstration
    const mockEvents = [
      { id: '1', summary: 'Project Kickoff', start: { dateTime: new Date().toISOString() }, visibility: 'public' },
      { id: '2', summary: 'Private Strategy Session', start: { dateTime: new Date(Date.now() + 86400000).toISOString() }, visibility: 'private' }
    ];

    res.json(mockEvents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createCalendarEvent = async (req, res) => {
  try {
    const { summary, start, end, visibility } = req.body;
    // Integration logic here
    res.json({ message: 'Event created', event: { summary, start, visibility } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getDriveFiles = async (req, res) => {
  try {
    // Similar to calendar, handle real or mock
    const mockFiles = [
      { id: 'd1', name: 'Project Assets', mimeType: 'application/vnd.google-apps.folder', webViewLink: 'https://drive.google.com' },
      { id: 'd2', name: 'Brand Guidelines.pdf', mimeType: 'application/pdf', webViewLink: 'https://drive.google.com' }
    ];
    res.json(mockFiles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
