const { createOAuth2Client, getCalendar, getDrive } = require('../utils/googleAuth');
const User = require('../models/User');
const ical = require('node-ical');

// Cache for Indian holidays (refreshed every 24h)
let holidayCache = null;
let holidayCacheExpiry = 0;

const INDIAN_HOLIDAY_ICAL_URL = 'https://calendar.google.com/calendar/ical/en.indian%23holiday%40group.v.calendar.google.com/public/basic.ics';

/**
 * Fetch Indian holidays from Google's public iCal feed.
 * Cached for 24 hours to avoid rate-limiting.
 */
const fetchIndianHolidays = async () => {
  const now = Date.now();
  if (holidayCache && now < holidayCacheExpiry) {
    return holidayCache;
  }

  try {
    const events = await ical.async.fromURL(INDIAN_HOLIDAY_ICAL_URL);
    const holidays = [];

    for (const [key, event] of Object.entries(events)) {
      if (event.type !== 'VEVENT') continue;

      const startDate = event.start;
      if (!startDate) continue;

      // Format date as YYYY-MM-DD
      const year = startDate.getFullYear();
      const month = String(startDate.getMonth() + 1).padStart(2, '0');
      const day = String(startDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      holidays.push({
        id: `holiday_${key}`,
        summary: event.summary || 'Holiday',
        description: event.description || '',
        start: { date: dateStr, dateTime: `${dateStr}T00:00:00.000Z` },
        type: 'holiday',
        visibility: 'public',
        source: 'google_calendar'
      });
    }

    // Sort by date
    holidays.sort((a, b) => a.start.date.localeCompare(b.start.date));

    holidayCache = holidays;
    holidayCacheExpiry = now + 24 * 60 * 60 * 1000; // 24h cache

    console.log(`[CALENDAR] Fetched ${holidays.length} Indian holidays from Google Calendar`);
    return holidays;
  } catch (error) {
    console.error('[CALENDAR] Failed to fetch holidays from Google, using fallback:', error.message);
    return getFallbackHolidays();
  }
};

/**
 * Fallback holidays if Google iCal fetch fails.
 */
const getFallbackHolidays = () => {
  return [
    { id: 'h1', summary: '🇮🇳 Republic Day', start: { date: '2026-01-26', dateTime: '2026-01-26T00:00:00.000Z' }, type: 'holiday', visibility: 'public' },
    { id: 'h2', summary: '🎨 Holi', start: { date: '2026-03-03', dateTime: '2026-03-03T00:00:00.000Z' }, type: 'holiday', visibility: 'public' },
    { id: 'h3', summary: '🌙 Eid al-Fitr', start: { date: '2026-04-01', dateTime: '2026-04-01T00:00:00.000Z' }, type: 'holiday', visibility: 'public' },
    { id: 'h4', summary: '🦁 Dr. Ambedkar Jayanti', start: { date: '2026-04-14', dateTime: '2026-04-14T00:00:00.000Z' }, type: 'holiday', visibility: 'public' },
    { id: 'h5', summary: '🇮🇳 Independence Day', start: { date: '2026-08-15', dateTime: '2026-08-15T00:00:00.000Z' }, type: 'holiday', visibility: 'public' },
    { id: 'h6', summary: '🤝 Raksha Bandhan', start: { date: '2026-08-28', dateTime: '2026-08-28T00:00:00.000Z' }, type: 'holiday', visibility: 'public' },
    { id: 'h7', summary: '🕉️ Janmashtami', start: { date: '2026-09-04', dateTime: '2026-09-04T00:00:00.000Z' }, type: 'holiday', visibility: 'public' },
    { id: 'h8', summary: '👓 Gandhi Jayanti', start: { date: '2026-10-02', dateTime: '2026-10-02T00:00:00.000Z' }, type: 'holiday', visibility: 'public' },
    { id: 'h9', summary: '🏹 Dussehra', start: { date: '2026-10-12', dateTime: '2026-10-12T00:00:00.000Z' }, type: 'holiday', visibility: 'public' },
    { id: 'h10', summary: '🪔 Diwali', start: { date: '2026-10-31', dateTime: '2026-10-31T00:00:00.000Z' }, type: 'holiday', visibility: 'public' },
    { id: 'h11', summary: '🎄 Christmas', start: { date: '2026-12-25', dateTime: '2026-12-25T00:00:00.000Z' }, type: 'holiday', visibility: 'public' },
    { id: 'h12', summary: '🙏 Mahatma Gandhi Punyatithi', start: { date: '2026-01-30', dateTime: '2026-01-30T00:00:00.000Z' }, type: 'holiday', visibility: 'public' },
    { id: 'h13', summary: '🌸 Maha Shivaratri', start: { date: '2026-02-15', dateTime: '2026-02-15T00:00:00.000Z' }, type: 'holiday', visibility: 'public' },
    { id: 'h14', summary: '🐏 Eid al-Adha', start: { date: '2026-06-07', dateTime: '2026-06-07T00:00:00.000Z' }, type: 'holiday', visibility: 'public' },
    { id: 'h15', summary: '🕌 Muharram', start: { date: '2026-06-27', dateTime: '2026-06-27T00:00:00.000Z' }, type: 'holiday', visibility: 'public' },
    { id: 'h16', summary: '🐘 Ganesh Chaturthi', start: { date: '2026-09-14', dateTime: '2026-09-14T00:00:00.000Z' }, type: 'holiday', visibility: 'public' },
    { id: 'h17', summary: '🕯️ Milad-un-Nabi', start: { date: '2026-08-26', dateTime: '2026-08-26T00:00:00.000Z' }, type: 'holiday', visibility: 'public' },
    { id: 'h18', summary: '🌾 Pongal / Makar Sankranti', start: { date: '2026-01-14', dateTime: '2026-01-14T00:00:00.000Z' }, type: 'holiday', visibility: 'public' },
    { id: 'h19', summary: '🎊 Navratri Begins', start: { date: '2026-10-03', dateTime: '2026-10-03T00:00:00.000Z' }, type: 'holiday', visibility: 'public' },
    { id: 'h20', summary: '💡 Guru Nanak Jayanti', start: { date: '2026-11-15', dateTime: '2026-11-15T00:00:00.000Z' }, type: 'holiday', visibility: 'public' },
  ];
};

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
    // Fetch Indian holidays from Google's public iCal feed
    const indianHolidays = await fetchIndianHolidays();

    // If user has linked Google account, fetch their personal events too
    let personalEvents = [];
    if (req.user.googleRefreshToken) {
      try {
        const oauth2Client = createOAuth2Client();
        oauth2Client.setCredentials({ refresh_token: req.user.googleRefreshToken });
        const calendar = getCalendar(oauth2Client);
        
        const now = new Date();
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const yearEnd = new Date(now.getFullYear(), 11, 31);
        
        const response = await calendar.events.list({
          calendarId: 'primary',
          timeMin: yearStart.toISOString(),
          timeMax: yearEnd.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 250
        });
        
        personalEvents = (response.data.items || []).map(event => ({
          id: event.id,
          summary: event.summary,
          start: event.start,
          visibility: event.visibility || 'default',
          type: 'personal'
        }));
      } catch (err) {
        console.error('[CALENDAR] Failed to fetch personal events:', err.message);
      }
    }

    // Combine holidays + personal events
    res.json([...personalEvents, ...indianHolidays]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Dedicated endpoint for just holidays (no auth required for public data)
exports.getIndianHolidays = async (req, res) => {
  try {
    const holidays = await fetchIndianHolidays();
    
    // Optional year filter
    const year = req.query.year || new Date().getFullYear().toString();
    const filtered = holidays.filter(h => h.start.date.startsWith(year));
    
    res.json(filtered);
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
