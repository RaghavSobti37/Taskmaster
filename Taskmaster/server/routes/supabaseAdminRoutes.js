const express = require('express');
const { protect, requirePageAccess } = require('../middleware/authMiddleware');
const { getSupabaseHealthReport } = require('../services/supabase/health');
const { closeSupabaseClients } = require('../services/supabase/client');

const router = express.Router();

// No dedicated UI — infra probe for Data Hub ops; same gate as data-hub routes (admin_data).
const dataHubAccess = requirePageAccess('admin_data');

router.use(protect, dataHubAccess);

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
