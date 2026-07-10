/**
 * Keyboard shortcuts — registry helpers + typing/mod detection.
 * Bindings live in shortcutDefaultsCore; user overrides via ShortcutPreference API.
 */

import {
  getDefaultBindingsMap,
  buildLegacyGChordRoutes,
  filterActionsForUser,
  NAV_ACTIONS,
} from './shortcutDefaultsShared';
import { canAccessNavPath } from '../utils/navPageAccess';
import { hasPageAccess, hasAnyPageAccess } from '../utils/pagePermissions';
import {
  G_CHORD_TIMEOUT_MS,
  buildShortcutSections,
  keysEqual,
  normalizeKeyTokens,
} from './shortcutBindingUtils';

export { G_CHORD_TIMEOUT_MS };

/** Default G-chord routes (tests / static display) */
export const GLOBAL_G_CHORD_ROUTES = buildLegacyGChordRoutes(getDefaultBindingsMap());

export function getGlobalGChordRoutes(bindingsMap, { isAdmin = false, user = null } = {}) {
  const map = bindingsMap || getDefaultBindingsMap();
  const routes = buildLegacyGChordRoutes(map, { isAdmin });
  if (!user) return routes;

  const filtered = {};
  for (const action of filterActionsForUser(NAV_ACTIONS, { isAdmin })) {
    const binding = map[action.id];
    if (!binding?.keys || binding.keys.length < 2 || binding.keys[0] !== 'g') continue;
    const secondKey = binding.keys[binding.keys.length - 1];
    if (secondKey.length !== 1) continue;
    const basePath = (action.path || '').split('?')[0];
    if (!basePath || !canAccessNavPath(user, basePath, hasPageAccess, hasAnyPageAccess)) continue;
    const route = routes[secondKey];
    if (route) filtered[secondKey] = route;
  }
  return filtered;
}

export const SHORTCUT_SECTIONS = buildShortcutSections(getDefaultBindingsMap());

export function buildShortcutSectionsForUser(bindingsMap, { isAdmin = false } = {}) {
  return buildShortcutSections(bindingsMap, { isAdmin });
}

export function filterShortcutSections(sections, { isAdmin = false } = {}) {
  return sections.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.adminOnly || isAdmin),
  }));
}

/**
 * @param {string} key — second key of a G-style sequence
 * @param {{ isAdmin?: boolean, bindingsMap?: Record<string, { keys: string[] }|null> }} opts
 */
export function resolveGChord(key, { isAdmin = false, bindingsMap } = {}) {
  const map = bindingsMap || getDefaultBindingsMap();
  const routes = buildLegacyGChordRoutes(map, { isAdmin });
  const route = routes[String(key || '').toLowerCase()];
  if (!route) return null;
  if (route.adminOnly && !isAdmin) return null;
  return route;
}

export function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (target.isContentEditable) return true;
  if (typeof target.closest === 'function' && target.closest('[data-shortcuts-ignore]')) return true;
  return false;
}

export function isModKey(e) {
  return e.metaKey || e.ctrlKey;
}

export function bindingMatchesSequenceStep(bindingKeys, prefixKeys) {
  const binding = normalizeKeyTokens(bindingKeys);
  const prefix = normalizeKeyTokens(prefixKeys);
  if (binding.length <= prefix.length) return false;
  return keysEqual(binding.slice(0, prefix.length), prefix);
}

export function bindingMatchesSequenceComplete(bindingKeys, prefixKeys, finalKey) {
  const binding = normalizeKeyTokens(bindingKeys);
  const full = normalizeKeyTokens([...prefixKeys, finalKey]);
  return keysEqual(binding, full);
}
