const DashboardPreset = require('../models/DashboardPreset');
const NavbarPreference = require('../models/NavbarPreference');
const ShortcutPreference = require('../models/ShortcutPreference');
const {
  SHORTCUT_ACTIONS,
  normalizeKeyTokens,
  mergeShortcutBindings,
} = require('../../shared/shortcutDefaults.cjs');
const { DEPARTMENT_PRESETS } = require('../models/DashboardPreset');
const logger = require('../utils/logger');
const {
  filterDashboardElements,
  canAccessComponent,
  VALID_DASHBOARD_COMPONENT_IDS,
} = require('../utils/dashboardComponents');
const { hasPageAccess, hasAnyPageAccess } = require('../utils/pagePermissions');
const { isLegacyNavbarGroups, migrateLegacyNavbarGroups } = require('../utils/navbarMigration');

const HUB_PATH_CHILD_KEYS = {
  '/crm': ['leads', 'followups', 'bookings'],
  '/office': ['equipment', 'contacts', 'subscriptions'],
  '/management': ['finance', 'announcements', 'ops_logs', 'artists'],
  '/admin/console': [
    'admin_users',
    'admin_roles',
    'admin_data',
    'admin_artist_path',
    'admin_exly',
    'admin_scripts',
    'admin_gamification',
    'admin_project_analytics',
  ],
};

const NAV_PATH_ACCESS = {
  '/dashboard': 'dashboard',
  '/calendar': 'calendar',
  '/todo': 'todo',
  '/inbox': 'inbox',
  '/projects': 'projects',
  '/assets': 'assets',
  '/schedule': 'schedule',
  '/logs': 'logs',
  '/emails': 'emails',
  '/equipment': 'equipment',
  '/contacts': 'contacts',
  '/subscriptions': 'subscriptions',
  '/attendance': 'attendance',
  '/leads': 'leads',
  '/followups': 'followups',
  '/bookings': 'bookings',
  '/finance': 'finance',
  '/announcements': 'announcements',
  '/ops-logs': 'ops_logs',
  '/artists': 'artists',
  '/admin/users': 'admin_users',
  '/admin/teams': 'admin_users',
  '/admin': 'admin_data',
  '/admin/exly-campaigns': 'admin_exly',
  '/admin/scripts': 'admin_scripts',
  '/admin/gamification': 'admin_gamification',
  '/admin/project-analytics': 'admin_project_analytics',
  '/admin/roles': 'admin_roles',
  '/admin/artist-path': 'admin_artist_path',
  '/admin/qa': 'admin_data',
  '/settings': 'settings',
  '/office-assets': 'office_assets',
  '/features': 'features',
  '/workflows': 'workflows',
  '/crm': 'crm_hub',
  '/office': 'office_hub',
  '/management': 'management_hub',
  '/admin/console': 'admin_console',
};

const canAccessNavPath = (user, path) => {
  if (!user) return false;
  const key = NAV_PATH_ACCESS[path];
  if (!key) return true;
  if (key.endsWith('_hub') || key === 'admin_console') {
    const hubPath = Object.keys(HUB_PATH_CHILD_KEYS).find((p) => NAV_PATH_ACCESS[p] === key);
    const childKeys = HUB_PATH_CHILD_KEYS[hubPath] || [];
    return hasAnyPageAccess(user, childKeys);
  }
  return hasPageAccess(user, key);
};

const filterNavbarGroupsForUser = (groups, user) => (groups || [])
  .map((group) => ({
    ...group,
    pages: (group.pages || []).filter((page) => {
      const path = normalizeNavPath(page.path);
      if (REMOVED_NAV_PATHS.has(path)) return false;
      return canAccessNavPath(user, path);
    }),
  }))
  .filter((group) => group.pages.length > 0);

const LEGACY_NAV_PATHS = {
  '/workspace/emails': '/emails',
  '/office/subscriptions': '/subscriptions',
  '/management/equipment': '/equipment',
  '/management/contacts': '/contacts',
  '/management/attendance': '/attendance',
};

const normalizeNavPath = (path) => LEGACY_NAV_PATHS[path] || path;

const REMOVED_NAV_PATHS = new Set(['/chat', '/settings']);

const dedupeNavPages = (pages) => {
  const seen = new Set();
  return (pages || []).filter((page) => {
    const path = normalizeNavPath(page.path);
    if (REMOVED_NAV_PATHS.has(path)) return false;
    if (seen.has(path)) return false;
    seen.add(path);
    page.path = path;
    return true;
  });
};

/** Add default pages missing from saved navbar groups (e.g. new features after user saved prefs). */
const mergeNavbarWithDefaults = (userGroups) => {
  const defaults = NavbarPreference.DEFAULT_NAVBAR_GROUPS;

  if (!Array.isArray(userGroups) || userGroups.length === 0) {
    return defaults;
  }

  let groups = userGroups.map((group) => ({
    ...group,
    pages: (group.pages || []).map((page) => ({
      ...page,
      path: normalizeNavPath(page.path),
    })),
  }));

  if (isLegacyNavbarGroups(groups)) {
    groups = migrateLegacyNavbarGroups(groups, defaults);
  }

  const merged = groups.map((group) => ({
    ...group,
    pages: dedupeNavPages(group.pages),
  }));

  for (const defaultGroup of defaults) {
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

  return merged
    .map((group) => ({
      ...group,
      pages: dedupeNavPages(group.pages),
    }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
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

    const presetObj = preset.toObject ? preset.toObject() : preset;
    res.json({
      ...presetObj,
      elements: filterDashboardElements(presetObj.elements, req.user),
    });
  } catch (error) {
    logger.error('Dashboard', 'Error fetching dashboard preset', { error: error.message });
    next(error);
  }
};

/** Save/update dashboard preset and optional named layout library entry */
exports.saveDashboardPreset = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { name, layoutName, elements, department } = req.body;
    const savedLayoutName = (layoutName || name || '').trim();

    if (!savedLayoutName) {
      return res.status(400).json({ error: 'Layout name is required' });
    }

    if (!elements || !Array.isArray(elements) || elements.length === 0) {
      return res.status(400).json({ error: 'Elements array is required' });
    }

    // Validate elements
    for (const element of elements) {
      if (!VALID_DASHBOARD_COMPONENT_IDS.includes(element.componentId)) {
        return res.status(400).json({ error: `Invalid component: ${element.componentId}` });
      }
      if (!canAccessComponent(element.componentId, req.user)) {
        return res.status(403).json({ error: `Not authorized for component: ${element.componentId}` });
      }
      if (!['1', '2', '3', '4'].includes(String(element.size))) {
        return res.status(400).json({ error: `Invalid size: ${element.size}` });
      }
    }

    const sortedElements = elements.sort((a, b) => a.order - b.order);
    const layoutEntry = {
      name: savedLayoutName,
      department: department || 'custom',
      elements: sortedElements,
      updatedAt: new Date(),
    };

    let existing = await DashboardPreset.findOne({ userId });
    const presets = [...(existing?.presets || [])];
    const idx = presets.findIndex(
      (p) => p.name && p.name.toLowerCase() === savedLayoutName.toLowerCase()
    );
    if (idx >= 0) {
      presets[idx] = layoutEntry;
    } else {
      presets.push(layoutEntry);
    }

    const preset = await DashboardPreset.findOneAndUpdate(
      { userId },
      {
        name: savedLayoutName,
        elements: sortedElements,
        department: department || 'custom',
        presets,
        updatedAt: new Date(),
      },
      { new: true, upsert: true }
    );

    const presetObj = preset.toObject ? preset.toObject() : preset;
    res.json({
      ...presetObj,
      elements: filterDashboardElements(presetObj.elements, req.user),
    });
  } catch (error) {
    logger.error('Dashboard', 'Error saving dashboard preset', { error: error.message });
    next(error);
  }
};

/** Load a named layout from the user's saved presets library */
exports.loadSavedLayout = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const layoutName = decodeURIComponent(req.params.layoutName || '').trim();

    if (!layoutName) {
      return res.status(400).json({ error: 'Layout name is required' });
    }

    const existing = await DashboardPreset.findOne({ userId });
    if (!existing) {
      return res.status(404).json({ error: `Layout not found: ${layoutName}` });
    }

    const saved = (existing.presets || []).find(
      (p) => p.name && p.name.toLowerCase() === layoutName.toLowerCase()
    );
    if (!saved?.elements?.length) {
      return res.status(404).json({ error: `Layout not found: ${layoutName}` });
    }

    const preset = await DashboardPreset.findOneAndUpdate(
      { userId },
      {
        name: saved.name,
        elements: saved.elements,
        department: saved.department || 'custom',
        updatedAt: new Date(),
      },
      { new: true }
    );

    const presetObj = preset.toObject ? preset.toObject() : preset;
    res.json({
      ...presetObj,
      elements: filterDashboardElements(presetObj.elements, req.user),
    });
  } catch (error) {
    logger.error('Dashboard', 'Error loading saved layout', { error: error.message });
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

    if (!preferences) {
      preferences = await NavbarPreference.create({
        userId,
        groups: NavbarPreference.DEFAULT_NAVBAR_GROUPS
      });
    } else if (preferences.pageOrder && !preferences.groups?.length) {
      preferences = await NavbarPreference.findOneAndUpdate(
        { userId },
        {
          $set: { groups: NavbarPreference.DEFAULT_NAVBAR_GROUPS },
          $unset: { pageOrder: 1 }
        },
        { new: true }
      );
    } else if (!preferences.groups?.length) {
      preferences = await NavbarPreference.findOneAndUpdate(
        { userId },
        {
          $set: { groups: NavbarPreference.DEFAULT_NAVBAR_GROUPS, updatedAt: new Date() }
        },
        { new: true }
      );
    }

    const doc = preferences.toObject ? preferences.toObject() : { ...preferences };
    doc.groups = filterNavbarGroupsForUser(
      mergeNavbarWithDefaults(doc.groups || []),
      req.user
    );
    res.json(doc);
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
    const sortedGroups = filterNavbarGroupsForUser(
      groups
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
        .sort((a, b) => a.order - b.order),
      req.user
    );

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

    const response = preferences.toObject ? preferences.toObject() : preferences;
    response.groups = filterNavbarGroupsForUser(response.groups, req.user);
    res.json(response);
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

// ============ SHORTCUT PREFERENCES ============

function sanitizeShortcutBindings(raw = {}) {
  const validIds = new Set(SHORTCUT_ACTIONS.map((a) => a.id));
  const out = {};

  for (const [id, value] of Object.entries(raw)) {
    if (!validIds.has(id)) continue;
    if (value === null) {
      out[id] = null;
      continue;
    }
    if (!value || !Array.isArray(value.keys) || value.keys.length === 0) continue;
    out[id] = { keys: normalizeKeyTokens(value.keys) };
  }

  return out;
}

/** Get user's keyboard shortcut overrides */
exports.getShortcutPreferences = async (req, res, next) => {
  try {
    const userId = req.user._id;
    let doc = await ShortcutPreference.findOne({ userId });

    if (!doc) {
      doc = await ShortcutPreference.create({ userId, bindings: {} });
    }

    const overrides = doc.bindings || {};
    const effective = mergeShortcutBindings(overrides);

    res.json({
      bindings: overrides,
      effectiveBindings: effective,
      updatedAt: doc.updatedAt,
    });
  } catch (error) {
    logger.error('Shortcuts', 'Error fetching shortcut preferences', { error: error.message });
    next(error);
  }
};

/** Save keyboard shortcut overrides */
exports.saveShortcutPreferences = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { bindings } = req.body;

    if (!bindings || typeof bindings !== 'object') {
      return res.status(400).json({ error: 'bindings object is required' });
    }

    const sanitized = sanitizeShortcutBindings(bindings);

    const doc = await ShortcutPreference.findOneAndUpdate(
      { userId },
      { bindings: sanitized, updatedAt: new Date() },
      { new: true, upsert: true }
    );

    const overrides = doc.bindings || {};
    res.json({
      bindings: overrides,
      effectiveBindings: mergeShortcutBindings(overrides),
      updatedAt: doc.updatedAt,
    });
  } catch (error) {
    logger.error('Shortcuts', 'Error saving shortcut preferences', { error: error.message });
    next(error);
  }
};

/** Reset shortcuts to app defaults */
exports.resetShortcutPreferences = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const doc = await ShortcutPreference.findOneAndUpdate(
      { userId },
      { bindings: {}, updatedAt: new Date() },
      { new: true, upsert: true }
    );

    res.json({
      bindings: {},
      effectiveBindings: mergeShortcutBindings({}),
      updatedAt: doc.updatedAt,
    });
  } catch (error) {
    logger.error('Shortcuts', 'Error resetting shortcut preferences', { error: error.message });
    next(error);
  }
};
