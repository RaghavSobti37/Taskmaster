const DashboardPreset = require('../models/DashboardPreset');
const NavbarPreference = require('../models/NavbarPreference');
const { DEPARTMENT_PRESETS } = require('../models/DashboardPreset');
const logger = require('../utils/logger');

const LEGACY_NAV_PATHS = {
  '/workspace/emails': '/emails',
  '/office/subscriptions': '/subscriptions',
  '/management/equipment': '/equipment',
  '/management/contacts': '/contacts',
  '/management/attendance': '/attendance',
};

const normalizeNavPath = (path) => LEGACY_NAV_PATHS[path] || path;

const dedupeNavPages = (pages) => {
  const seen = new Set();
  return (pages || []).filter((page) => {
    const path = normalizeNavPath(page.path);
    if (seen.has(path)) return false;
    seen.add(path);
    page.path = path;
    return true;
  });
};

/** Add default pages missing from saved navbar groups (e.g. new features after user saved prefs). */
const mergeNavbarWithDefaults = (userGroups) => {
  if (!Array.isArray(userGroups) || userGroups.length === 0) {
    return NavbarPreference.DEFAULT_NAVBAR_GROUPS;
  }

  const merged = userGroups.map((group) => ({
    ...group,
    pages: (group.pages || []).map((page) => ({
      ...page,
      path: normalizeNavPath(page.path),
    })),
  }));

  for (const defaultGroup of NavbarPreference.DEFAULT_NAVBAR_GROUPS) {
    let userGroup = merged.find((g) => g.id === defaultGroup.id);
    if (!userGroup) {
      merged.push({ ...defaultGroup, pages: [...defaultGroup.pages] });
      continue;
    }
    userGroup.pages = dedupeNavPages(userGroup.pages);
    const existingPaths = new Set((userGroup.pages || []).map((p) => p.path));
    for (const defaultPage of defaultGroup.pages) {
      const path = normalizeNavPath(defaultPage.path);
      if (!existingPaths.has(path)) {
        userGroup.pages = [...(userGroup.pages || []), { ...defaultPage, path, visible: true }];
        existingPaths.add(path);
      }
    }
    userGroup.pages = dedupeNavPages(userGroup.pages);
  }

  return merged.map((group) => ({
    ...group,
    pages: dedupeNavPages(group.pages),
  }));
};

// ============ DASHBOARD ENDPOINTS ============

/** Get user's current dashboard preset */
exports.getDashboardPreset = async (req, res, next) => {
  try {
    const userId = req.user._id;

    let preset = await DashboardPreset.findOne({ userId });

    if (!preset) {
      // Create default preset on first access
      preset = await DashboardPreset.create({
        userId,
        name: 'My Dashboard',
        department: 'custom',
        elements: [
          { componentId: 'leaderboard', size: '1', col: 1, row: 1, order: 1, visible: true },
          { componentId: 'announcements', size: '1', col: 2, row: 1, order: 2, visible: true },
          { componentId: 'pinboard', size: '1', col: 3, row: 1, order: 3, visible: true },
          { componentId: 'schedule', size: '1', col: 4, row: 1, order: 4, visible: true },
          { componentId: 'review-queue', size: '2', col: 1, row: 2, order: 5, visible: true },
          { componentId: 'todos-overdue', size: '2', col: 3, row: 2, order: 6, visible: true },
          { componentId: 'todos-today', size: '2', col: 1, row: 3, order: 7, visible: true },
          { componentId: 'projects-today', size: '4', col: 1, row: 4, order: 8, visible: true },
          { componentId: 'notes', size: '2', col: 1, row: 5, order: 9, visible: true },
          { componentId: 'composer', size: '2', col: 3, row: 5, order: 10, visible: true }
        ]
      });
    }

    res.json(preset);
  } catch (error) {
    logger.error('Dashboard', 'Error fetching dashboard preset', { error: error.message });
    next(error);
  }
};

/** Save/update dashboard preset */
exports.saveDashboardPreset = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { name, elements, department } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Preset name is required' });
    }

    if (!elements || !Array.isArray(elements) || elements.length === 0) {
      return res.status(400).json({ error: 'Elements array is required' });
    }

    // Validate elements
    const validComponentIds = [
      'leaderboard', 'announcements', 'pinboard', 'schedule',
      'review-queue', 'todos-today', 'todos-overdue', 'projects-today', 
      'notes', 'composer', 'stats', 'mark-attendance', 'leave-alerts',
      'invoice-alerts', 'attendance-overview', 'team-activity',
      'booked-calls', 'followups-today', 'pipeline-summary',
      'campaign-metrics', 'dept-stats', 'system-health', 'artist-calendar'
    ];

    for (const element of elements) {
      if (!validComponentIds.includes(element.componentId)) {
        return res.status(400).json({ error: `Invalid component: ${element.componentId}` });
      }
      if (!['1', '2', '3', '4'].includes(String(element.size))) {
        return res.status(400).json({ error: `Invalid size: ${element.size}` });
      }
    }

    // Sort elements by order
    const sortedElements = elements.sort((a, b) => a.order - b.order);

    const preset = await DashboardPreset.findOneAndUpdate(
      { userId },
      {
        name: name.trim(),
        elements: sortedElements,
        department: department || 'custom',
        updatedAt: new Date()
      },
      { new: true, upsert: true }
    );

    res.json(preset);
  } catch (error) {
    logger.error('Dashboard', 'Error saving dashboard preset', { error: error.message });
    next(error);
  }
};

/** Load a department preset */
exports.loadDepartmentPreset = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { department } = req.params;

    if (!DEPARTMENT_PRESETS[department]) {
      return res.status(404).json({ error: `Department preset not found: ${department}` });
    }

    const preset = await DashboardPreset.findOneAndUpdate(
      { userId },
      {
        ...DEPARTMENT_PRESETS[department],
        updatedAt: new Date()
      },
      { new: true, upsert: true }
    );

    res.json(preset);
  } catch (error) {
    logger.error('Dashboard', 'Error loading department preset', { error: error.message });
    next(error);
  }
};

/** Get available department presets */
exports.getDepartmentPresets = async (req, res, next) => {
  try {
    const presets = Object.entries(DEPARTMENT_PRESETS).map(([key, value]) => ({
      id: key,
      ...value
    }));

    res.json(presets);
  } catch (error) {
    logger.error('Dashboard', 'Error fetching department presets', { error: error.message });
    next(error);
  }
};

/** Update element visibility */
exports.updateElementVisibility = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { componentId, visible } = req.body;

    const preset = await DashboardPreset.findOneAndUpdate(
      { userId, 'elements.componentId': componentId },
      {
        $set: {
          'elements.$.visible': visible,
          updatedAt: new Date()
        }
      },
      { new: true }
    );

    if (!preset) {
      return res.status(404).json({ error: 'Preset or element not found' });
    }

    res.json(preset);
  } catch (error) {
    logger.error('Dashboard', 'Error updating element visibility', { error: error.message });
    next(error);
  }
};

/** Reorder dashboard elements */
exports.reorderDashboardElements = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { elements } = req.body;

    if (!Array.isArray(elements) || elements.length === 0) {
      return res.status(400).json({ error: 'Elements array is required' });
    }

    // Validate and sort
    const sortedElements = elements
      .map((el, idx) => ({ ...el, order: idx + 1 }))
      .sort((a, b) => a.order - b.order);

    const preset = await DashboardPreset.findOneAndUpdate(
      { userId },
      {
        elements: sortedElements,
        updatedAt: new Date()
      },
      { new: true }
    );

    res.json(preset);
  } catch (error) {
    logger.error('Dashboard', 'Error reordering elements', { error: error.message });
    next(error);
  }
};

// ============ NAVBAR ENDPOINTS ============

/** Get user's navbar preferences */
exports.getNavbarPreferences = async (req, res, next) => {
  try {
    const userId = req.user._id;

    let preferences = await NavbarPreference.findOne({ userId });

    if (!preferences || (!preferences.groups && !preferences.pageOrder)) {
      // Create default preferences on first access
      preferences = await NavbarPreference.create({
        userId,
        groups: NavbarPreference.DEFAULT_NAVBAR_GROUPS
      });
    } else if (preferences.pageOrder && (!preferences.groups || preferences.groups.length === 0)) {
      // Migrate old pageOrder to groups by resetting to defaults
      preferences = await NavbarPreference.findOneAndUpdate(
        { userId },
        { 
          $set: { groups: NavbarPreference.DEFAULT_NAVBAR_GROUPS },
          $unset: { pageOrder: 1 } 
        },
        { new: true }
      );
    }

    if (preferences?.groups?.length) {
      preferences = preferences.toObject ? preferences.toObject() : { ...preferences };
      preferences.groups = mergeNavbarWithDefaults(preferences.groups);
    }

    res.json(preferences);
  } catch (error) {
    logger.error('Navbar', 'Error fetching navbar preferences', { error: error.message });
    next(error);
  }
};

/** Save navbar preferences */
exports.saveNavbarPreferences = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { groups } = req.body;

    if (!Array.isArray(groups) || groups.length === 0) {
      return res.status(400).json({ error: 'Groups array is required' });
    }

    // Validate and sort
    const sortedGroups = groups
      .map((group, idx) => ({
        id: group.id,
        title: group.title,
        order: idx + 1,
        visible: group.visible !== false,
        isCustom: group.isCustom || false,
        pages: (group.pages || [])
          .map((page, pIdx) => ({
            path: page.path,
            label: page.label,
            order: pIdx + 1,
            visible: page.visible !== false
          }))
          .sort((a, b) => a.order - b.order)
      }))
      .sort((a, b) => a.order - b.order);

    const preferences = await NavbarPreference.findOneAndUpdate(
      { userId },
      {
        groups: sortedGroups,
        updatedAt: new Date()
      },
      { new: true, upsert: true }
    );

    res.json(preferences);
  } catch (error) {
    logger.error('Navbar', 'Error saving navbar preferences', { error: error.message });
    next(error);
  }
};

/** Reset navbar to defaults */
exports.resetNavbarToDefaults = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const preferences = await NavbarPreference.findOneAndUpdate(
      { userId },
      {
        groups: NavbarPreference.DEFAULT_NAVBAR_GROUPS,
        updatedAt: new Date()
      },
      { new: true, upsert: true }
    );

    res.json(preferences);
  } catch (error) {
    logger.error('Navbar', 'Error resetting navbar', { error: error.message });
    next(error);
  }
};

/** Toggle page visibility */
exports.togglePageVisibility = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { path, visible } = req.body;

    // This requires updating a nested array in MongoDB which can be complex.
    // Simpler to fetch, mutate, and save.
    const preferences = await NavbarPreference.findOne({ userId });
    if (!preferences) {
      return res.status(404).json({ error: 'Preferences not found' });
    }

    let found = false;
    for (const group of preferences.groups) {
      for (const page of group.pages) {
        if (page.path === path) {
          page.visible = visible;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    if (!found) {
      return res.status(404).json({ error: 'Page not found in preferences' });
    }

    preferences.updatedAt = new Date();
    await preferences.save();

    res.json(preferences);
  } catch (error) {
    logger.error('Navbar', 'Error toggling page visibility', { error: error.message });
    next(error);
  }
};
