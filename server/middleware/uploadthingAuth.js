const { protect } = require('./authMiddleware');

/** UT ingest callbacks use uploadthing-hook — no session JWT. */
const protectUploadthingClient = (req, res, next) => {
  if (req.headers['uploadthing-hook']) return next();
  return protect(req, res, next);
};

module.exports = { protectUploadthingClient };
