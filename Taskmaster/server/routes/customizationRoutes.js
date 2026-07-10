const express = require('express');
const customizationController = require('../controllers/customizationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// All customization routes require authentication
router.use(protect);

// ============ DASHBOARD ROUTES ============

/**
 * @GET /api/customization/dashboard/preset
 * Get user's current dashboard preset
 */
router.get('/dashboard/preset', customizationController.getDashboardPreset);

/**
 * @POST /api/customization/dashboard/preset
 * Save/update dashboard preset
 * Body: { name, elements: [{componentId, size, order, visible}], department }
 */
router.post('/dashboard/preset', customizationController.saveDashboardPreset);

/**
 * @POST /api/customization/dashboard/preset/layout/:layoutName
 * Activate a named layout from the user's saved library
 */
router.post('/dashboard/preset/layout/:layoutName', customizationController.loadSavedLayout);

/**
 * @GET /api/customization/dashboard/presets/department
 * Get list of available department presets
 */
router.get('/dashboard/presets/department', customizationController.getDepartmentPresets);

/**
 * @POST /api/customization/dashboard/preset/department/:department
 * Load a department preset
 */
router.post('/dashboard/preset/department/:department', customizationController.loadDepartmentPreset);

/**
 * @PATCH /api/customization/dashboard/element/visibility
 * Update single element visibility
 * Body: { componentId, visible }
 */
router.patch('/dashboard/element/visibility', customizationController.updateElementVisibility);

/**
 * @PUT /api/customization/dashboard/reorder
 * Reorder dashboard elements
 * Body: { elements: [{componentId, size, visible}] }
 */
router.put('/dashboard/reorder', customizationController.reorderDashboardElements);

// ============ SHORTCUT ROUTES ============

router.get('/shortcuts', customizationController.getShortcutPreferences);
router.post('/shortcuts', customizationController.saveShortcutPreferences);
router.post('/shortcuts/reset', customizationController.resetShortcutPreferences);

module.exports = router;
