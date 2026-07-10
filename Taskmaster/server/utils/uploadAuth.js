const { resolveRequestUser } = require('../middleware/authMiddleware');

/**
 * UploadThing route middleware — verifies session (Clerk or legacy JWT), not token presence alone.
 * UploadThing server callbacks use uploadthing-hook and skip user auth.
 */
async function requireAuthenticatedUpload(req) {
  if (req.headers['uploadthing-hook']) {
    return { userId: 'uploadthing-callback' };
  }

  const { user, suspended } = await resolveRequestUser(req);
  if (suspended || !user) {
    throw new Error('Unauthorized — sign in again and retry the upload');
  }

  req.user = user;
  return { userId: user._id.toString() };
}

module.exports = { requireAuthenticatedUpload };
