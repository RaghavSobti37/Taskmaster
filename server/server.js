require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');
const userRoutes = require('./routes/userRoutes');
const logRoutes = require('./routes/logRoutes');
const chatRoutes = require('./routes/chatRoutes');
const teamRoutes = require('./routes/teamRoutes');
const crmRoutes = require('./routes/crmRoutes');
const googleRoutes = require('./routes/googleRoutes');
const artistRoutes = require('./routes/artistRoutes');


const app = express();

// Trust proxy for Render/Vercel (required for express-rate-limit)
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(compression());

// Production CORS Configuration
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS ? process.env.CORS_ALLOWED_ORIGINS.split(',') : ['http://localhost:5173', 'http://localhost:5174'];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ 
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(mongoSanitize({ allowDots: true }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000 
});
app.use('/api/', limiter);

// MongoDB Connection
const dbUri = (process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/coreknot').trim();

// Mask URI for logging
const maskedUri = dbUri.replace(/\/\/.*:.*@/, '//****:****@');
console.log(`[SYSTEM] Initializing DB Connection: ${maskedUri}`);

mongoose.connect(dbUri, {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 60000,
  heartbeatFrequencyMS: 10000,
})
  .then(() => {
    console.log('[SUCCESS] MongoDB Connected');
    
    // Auto-repair zero-dipped history snapshots on startup
    (async () => {
      try {
        const Artist = require('./models/Artist');
        const artists = await Artist.find();
        for (const artist of artists) {
          if (artist.analyticsHistory && artist.analyticsHistory.length > 0) {
            const currentIg = artist.analytics?.instagram?.followers || 0;
            const currentSp = artist.analytics?.spotify?.followers || 0;
            
            const cleanHistory = artist.analyticsHistory.filter(h => {
              const ig = h.metrics?.instagram?.followers;
              const sp = h.metrics?.spotify?.followers;
              if (currentIg > 0 && ig === 0) return false;
              if (currentSp > 0 && sp === 0) return false;
              return true;
            });
            
            if (cleanHistory.length !== artist.analyticsHistory.length) {
              const removedCount = artist.analyticsHistory.length - cleanHistory.length;
              artist.analyticsHistory = cleanHistory;
              artist.markModified('analyticsHistory');
              await artist.save();
              console.log(`🧹 [Database Repair] Cleaned ${removedCount} corrupted snapshots for ${artist.name}`);
            }
          }
        }
      } catch (err) {
        console.error('❌ [Database Repair] Error during startup scan:', err.message);
      }
    })();
  })
  .catch(err => {
    console.error('[ERROR] Initial MongoDB connection failed:', err.message);
    console.log('[SYSTEM] Server will remain active but DB operations will fail until connection is established.');
  });

mongoose.connection.on('error', err => {
  console.error('[ERROR] Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('[WARN] Mongoose disconnected. Attempting reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('[SUCCESS] Mongoose reconnected.');
});

// Routes
app.use('/api/auth', authRoutes);

// Apply logger to all subsequent routes (which usually require auth)
// Logger middleware
const systemLogger = require('./middleware/loggerMiddleware');
app.use(systemLogger);

app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/teams', teamRoutes);

// Public tracking webhooks & unsubscribe endpoints
app.use(require('./routes/track')); // Mounts /webhooks/bounces and /unsubscribe at root
app.post('/api/crm/unsubscribe', async (req, res) => {
  const { email, reason } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const Lead = require('./models/Lead');
    const cleanEmail = email.toLowerCase().trim();
    const leadDoc = await Lead.findOne({ email: cleanEmail });
    const leadName = leadDoc ? leadDoc.name : '';

    await Lead.updateMany(
      { email: cleanEmail },
      { $set: { unsubscribed: true, unsubscribeReason: reason || 'Opt-out', emailStatus: 'Unsubscribed', status: 'inactive' } }
    );

    // Sync to HolySheet
    const { syncUnsubscribeToSheet } = require('./services/holySheetService');
    await syncUnsubscribeToSheet({
      email: cleanEmail,
      name: leadName,
      campaignId: 'CRM_MANUAL',
      reason: reason || 'Opt-out',
      unsubscribedAt: new Date()
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use('/api/crm', crmRoutes);
app.use('/api/assets', require('./routes/assetRoutes'));
app.use('/api/google', googleRoutes);
app.use('/api/google/accounts', require('./routes/googleAccounts'));
app.use('/api/artists', artistRoutes);
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/calendar', require('./routes/calendarRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/mail', require('./routes/mailRoutes'));
app.use('/api/ses', require('./routes/sesRoutes'));
app.use('/api/tsc', require('./routes/tscRoutes'));
app.use('/api/track', require('./routes/track'));
app.use('/api/campaigns', require('./routes/campaignRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/webhooks', require('./routes/webhookRoutes'));
app.use('/api/office-assets', require('./routes/officeAssetRoutes'));
app.use('/api/contacts', require('./routes/contactRoutes'));
app.use('/api/exly', require('./routes/exlyRoutes'));

const { createRouteHandler } = require("uploadthing/express");
const { uploadRouter } = require("./config/uploadthing");
app.use(
  "/api/uploadthing",
  createRouteHandler({
    router: uploadRouter,
    config: {
      uploadthingSecret: process.env.UPLOADTHING_SECRET || process.env.UPLOADTHING_TOKEN,
      uploadthingId: process.env.UPLOADTHING_APP_ID || "app_id",
    },
  })
);

const path = require('path');
const fs = require('fs');
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../client/dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath, {
      maxAge: '1y',
      etag: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    app.get('/', (req, res) => res.send('CoreKnot API Active (Production backend online. Frontend build pending at: ' + distPath + ')'));
  }
} else {
  app.get('/', (req, res) => res.send('CoreKnot API Active (Development Mode)'));
}

// Centralized structured error handling middleware
const errorHandler = require('./middleware/errorMiddleware');
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Initialize Reminder Service
  const notificationService = require('./services/notificationService');
  notificationService.init();


});
