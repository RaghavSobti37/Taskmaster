const Log = require('../models/Log');

const systemLogger = async (req, res, next) => {
  const originalSend = res.send;

  res.send = function (data) {
    res.send = originalSend;
    
    // Asynchronous logging - don't await, let it run in background
    if (req.user && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE')) {
      Log.create({
        userId: req.user._id,
        action: `${req.method} ${req.originalUrl}`,
        targetId: req.params.id || null,
        details: {
          body: req.body,
          statusCode: res.statusCode
        }
      }).catch(err => console.error('Logging error:', err));
    }
    
    return res.send(data);
  };

  next();
};

module.exports = systemLogger;
