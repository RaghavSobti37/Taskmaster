const express = require('express');
const multer = require('multer');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { handleUploadFilesManyRequest } = require('../utils/uploadthingServer');
const {
  listChannels,
  getChannel,
  getMessages,
  sendMessage,
  markRead,
  openDm,
  createGroupChannel,
  updateChannel,
  updateChannelMembers,
  emitTyping,
} = require('../controllers/chatController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 32 * 1024 * 1024, files: 12 },
});

router.use(protect);

router.get('/channels', listChannels);
router.post('/channels', createGroupChannel);
router.get('/channels/:id', getChannel);
router.patch('/channels/:id', updateChannel);
router.get('/channels/:id/messages', getMessages);
router.post('/channels/:id/messages', sendMessage);
router.patch('/channels/:id/read', markRead);
router.patch('/channels/:id/members', updateChannelMembers);
router.post('/channels/:id/typing', emitTyping);

router.post('/dm', openDm);

router.post('/upload', (req, res, next) => {
  upload.array('files', 12)(req, res, (err) => {
    if (err?.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files in one batch (max 12). Upload in smaller groups.',
      });
    }
    if (err) return next(err);
    return handleUploadFilesManyRequest(req, res);
  });
});

module.exports = router;
