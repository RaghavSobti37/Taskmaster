const express = require('express');
const { protect, admin } = require('../middleware/authMiddleware');
const { getSupabaseHealthReport } = require('../services/supabase/health');
const { closeSupabaseClients } = require('../services/supabase/client');

const router = express.Router();

router.use(protect, admin);

router.get('/health', async (_req, res) => {
  try {
    const report = await getSupabaseHealthReport();
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  } finally {
    await closeSupabaseClients();
  }
});

module.exports = router;
