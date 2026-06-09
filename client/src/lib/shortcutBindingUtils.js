import {
  SHORTCUT_ACTIONS,
  SYSTEM_SHORTCUT_CONFLICTS,
  SHORTCUT_CATEGORY_LABELS,
  normalizeKeyTokens,
  keysEqual,
  mergeShortcutBindings,
  getActionById,
  filterActionsForUser,
  buildLegacyGChordRoutes,
} from './shortcutDefaultsShared';

export const G_CHORD_TIMEOUT_MS = 1500;

export function isMacPlatform() {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
}

export function getPlatformTag() {
  if (typeof navigator === 'undefined') return 'all';
  const p = navigator.platform || '';
  const ua = navigator.userAgent || '';
  if (/Mac|iPhone|iPad|iPod/.test(p) || /Mac OS/.test(ua)) return 'mac';
  if (/Win/.test(p)) return 'win';
  return 'linux';
}

function conflictAppliesToPlatform(entry, platform = getPlatformTag()) {
  const platforms = entry.platforms || ['all'];
  return platforms.includes('all') || platforms.includes(platform);
}

export function formatKeysForDisplay(keys, { mac = isMacPlatform() } = {}) {
  const tokens = normalizeKeyTokens(keys);
  if (!tokens.length) return 'Disabled';

  const modLabel = mac ? '⌘' : 'Ctrl';
  return tokens
    .map((k) => {
      if (k === 'mod') return modLabel;
      if (k === 'shift') return '⇧';
      if (k === 'alt') return mac ? '⌥' : 'Alt';
      if (k === 'meta') return '⌘';
      if (k === 'ctrl') return 'Ctrl';
      if (k === 'escape') return 'Esc';
      if (k === 'enter') return '↵';
      if (k === 'delete') return 'Del';
      if (k === 'space') return 'Space';
      if (k.startsWith('f') && /^f\d+$/i.test(k)) return k.toUpperCase();
      if (k.length === 1) return k.toUpperCase();
      return k;
    })
    .join(' ');
}

const EVENT_KEY_ALIASES = {
  esc: 'escape',
  escape: 'escape',
  enter: 'enter',
  return: 'enter',
  del: 'delete',
  delete: 'delete',
  backspace: 'backspace',
  spacebar: 'space',
  space: 'space',
  arrowup: 'arrowup',
  arrowdown: 'arrowdown',
  arrowleft: 'arrowleft',
  arrowright: 'arrowright',
};

export function isModifierOnlyKeyEvent(e) {
  const k = e.key;
  return k === 'Shift' || k === 'Control' || k === 'Alt' || k === 'Meta';
}

export function mainKeyFromEvent(e) {
  if (e.key === ' ' || e.code === 'Space') return 'space';
  if (e.key === '?' || (e.key === '/' && e.shiftKey)) return '?';
  if (e.key.length === 1) return e.key.toLowerCase();

  const lowered = String(e.key || '').toLowerCase();
  if (EVENT_KEY_ALIASES[lowered]) return EVENT_KEY_ALIASES[lowered];

  if (e.code?.startsWith('Key')) return e.code.slice(3).toLowerCase();
  if (e.code?.startsWith('Digit')) return e.code.slice(5);
  if (/^F\d+$/i.test(e.code)) return e.code.toLowerCase();

  return lowered;
}

export function bindingFromKeyboardEvent(e) {
  const keys = [];
  if (e.ctrlKey || e.metaKey) keys.push('mod');
  if (e.shiftKey) keys.push('shift');
  if (e.altKey) keys.push('alt');

  const modifierKeys = new Set(['control', 'shift', 'alt', 'meta']);
  const rawKey = String(e.key || '').toLowerCase();
  if (modifierKeys.has(rawKey)) {
    return { keys: normalizeKeyTokens(keys) };
  }

  const main = mainKeyFromEvent(e);
  if (main) keys.push(main);

  return { keys: normalizeKeyTokens(keys) };
}

export function bindingHasMainKey(keys) {
  return normalizeKeyTokens(keys).some(
    (k) => !['mod', 'shift', 'alt', 'ctrl', 'meta'].includes(k)
  );
}

export function modsFromEvent(e) {
  return {
    mod: e.ctrlKey || e.metaKey,
    shift: e.shiftKey,
    alt: e.altKey,
  };
}

export function buildBindingFromModsAndMain(mods, mainKey) {
  const keys = [];
  if (mods.mod) keys.push('mod');
  if (mods.shift) keys.push('shift');
  if (mods.alt) keys.push('alt');
  if (mainKey) keys.push(mainKey);
  return { keys: normalizeKeyTokens(keys) };
}

export function isSequenceBinding(keys) {
  const tokens = normalizeKeyTokens(keys);
  if (tokens.length < 2) return false;
  if (tokens.some((t) => ['mod', 'shift', 'alt', 'ctrl', 'meta'].includes(t))) return false;
  return true;
}

export function eventMatchesCombo(e, keys) {
  const eventBinding = bindingFromKeyboardEvent(e);
  if (keysEqual(eventBinding.keys, keys)) return true;

  const normalized = normalizeKeyTokens(keys);
  if (normalized.length === 1 && !['mod', 'shift', 'alt', 'ctrl', 'meta'].includes(normalized[0])) {
    const pressed = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
    if (pressed === normalized[0] && !e.metaKey && !e.ctrlKey && !e.altKey) return true;
  }

  return false;
}

/**
 * @returns {{ type: 'browser' | 'system' | 'app', label: string, scope?: string, actionId?: string }[]}
 */
export function getBindingConflicts(keys, { bindingsMap, excludeActionId, actions = SHORTCUT_ACTIONS } = {}) {
  const conflicts = [];
  const normalized = normalizeKeyTokens(keys);
  if (!normalized.length) return conflicts;
  const platform = getPlatformTag();

  for (const sys of SYSTEM_SHORTCUT_CONFLICTS) {
    if (!conflictAppliesToPlatform(sys, platform)) continue;
    if (keysEqual(sys.keys, normalized)) {
      conflicts.push({
        type: sys.scope === 'browser' ? 'browser' : 'system',
        label: sys.label,
        scope: sys.scope || 'browser',
      });
    }
  }

  if (bindingsMap) {
    for (const action of actions) {
      if (action.id === excludeActionId) continue;
      const binding = bindingsMap[action.id];
      if (binding?.keys && keysEqual(binding.keys, normalized)) {
        conflicts.push({ type: 'app', label: action.label, scope: 'CoreKnot', actionId: action.id });
      }
    }
  }

  return conflicts;
}

export function formatConflictLabel(conflict) {
  if (conflict.type === 'browser') return `Browser — ${conflict.label}`;
  if (conflict.type === 'system') {
    const scope = conflict.scope === 'macOS' ? 'macOS' : conflict.scope === 'Windows' ? 'Windows' : 'System';
    return `${scope} — ${conflict.label}`;
  }
  return `CoreKnot — ${conflict.label}`;
}

export function buildShortcutSections(bindingsMap, { isAdmin = false } = {}) {
  const actions = filterActionsForUser(SHORTCUT_ACTIONS, { isAdmin });
  const byCategory = { global: [], quick: [], nav: [] };

  for (const action of actions) {
    const binding = bindingsMap[action.id];
    const display = binding ? formatKeysForDisplay(binding.keys) : 'Disabled';
    byCategory[action.category]?.push({
      id: action.id,
      label: action.label,
      display,
      adminOnly: action.adminOnly,
    });
  }

  return [
    {
      title: SHORTCUT_CATEGORY_LABELS.global,
      items: byCategory.global,
    },
    {
      title: SHORTCUT_CATEGORY_LABELS.quick,
      items: byCategory.quick,
    },
    {
      title: SHORTCUT_CATEGORY_LABELS.nav,
      subtitle: 'Two-key sequences — press first key, then second within 1.5s',
      items: byCategory.nav,
    },
    {
      title: 'Command palette (when open)',
      items: [
        { id: 'up-down', label: 'Move selection', display: '↑ ↓' },
        { id: 'enter', label: 'Run selected action', display: 'Enter' },
        { id: 'esc', label: 'Close', display: 'Esc' },
      ],
    },
  ];
}

export function resolveBindingAction(keys, bindingsMap, { isAdmin = false } = {}) {
  const actions = filterActionsForUser(SHORTCUT_ACTIONS, { isAdmin });
  for (const action of actions) {
    const binding = bindingsMap[action.id];
    if (binding?.keys && keysEqual(binding.keys, keys)) {
      return action;
    }
  }
  return null;
}

export function findSequenceStarts(key, bindingsMap, { isAdmin = false } = {}) {
  const actions = filterActionsForUser(SHORTCUT_ACTIONS, { isAdmin });
  const prefix = normalizeKeyTokens([key]);
  const matches = [];
  for (const action of actions) {
    const binding = bindingsMap[action.id];
    if (!binding?.keys || !isSequenceBinding(binding.keys)) continue;
    if (keysEqual(binding.keys.slice(0, 1), prefix)) {
      matches.push({ action, binding });
    }
  }
  return matches;
}

export {
  SHORTCUT_ACTIONS,
  SYSTEM_SHORTCUT_CONFLICTS,
  SHORTCUT_CATEGORY_LABELS,
  normalizeKeyTokens,
  keysEqual,
  mergeShortcutBindings,
  getActionById,
  filterActionsForUser,
  buildLegacyGChordRoutes,
};
