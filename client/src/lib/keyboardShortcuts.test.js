import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { SHORTCUT_ACTIONS as CLIENT_ACTIONS } from './shortcutDefaultsCore';

const require = createRequire(import.meta.url);
const serverDefaults = require('../../../shared/shortcutDefaults.cjs');
import {
  resolveGChord,
  isTypingTarget,
  filterShortcutSections,
  buildShortcutSectionsForUser,
  GLOBAL_G_CHORD_ROUTES,
  getGlobalGChordRoutes,
} from './keyboardShortcuts';
import { mergeShortcutBindings } from './shortcutDefaultsShared';
import { getBindingConflicts } from './shortcutBindingUtils';

describe('shortcutDefaults parity', () => {
  it('client ESM and server CJS registries stay in sync', () => {
    expect(CLIENT_ACTIONS.length).toBe(serverDefaults.SHORTCUT_ACTIONS.length);
    const clientIds = CLIENT_ACTIONS.map((a) => a.id).sort();
    const serverIds = serverDefaults.SHORTCUT_ACTIONS.map((a) => a.id).sort();
    expect(clientIds).toEqual(serverIds);
  });
});

describe('keyboardShortcuts', () => {
  it('resolves global G chords for all users', () => {
    expect(resolveGChord('t')?.path).toBe('/todo');
    expect(resolveGChord('h')?.path).toBe('/admin');
  });

  it('blocks admin-only chords for non-admin', () => {
    expect(resolveGChord('u', { isAdmin: false })).toBeNull();
    expect(resolveGChord('u', { isAdmin: true })?.path).toBe('/admin/users');
  });

  it('detects typing targets', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV' })).toBe(false);
  });

  it('filters admin shortcuts from help overlay', () => {
    const sections = buildShortcutSectionsForUser(mergeShortcutBindings());
    const filtered = filterShortcutSections(sections, { isAdmin: false });
    const nav = filtered.find((s) => s.title === 'Navigation');
    const ids = nav.items.map((i) => i.id);
    expect(ids).not.toContain('nav-users');
    expect(ids).toContain('nav-todo');
  });

  it('covers core routes in registry', () => {
    expect(GLOBAL_G_CHORD_ROUTES.t.path).toBe('/todo');
    expect(GLOBAL_G_CHORD_ROUTES.n.path).toBe('/notes');
  });

  it('respects custom G chord overrides', () => {
    const bindings = mergeShortcutBindings({
      'nav-todo': { keys: ['g', 'x'] },
    });
    const routes = getGlobalGChordRoutes(bindings);
    expect(routes.x?.path).toBe('/todo');
    expect(routes.t).toBeUndefined();
  });
});

describe('shortcutBindingUtils conflicts', () => {
  it('flags system shortcut conflicts', () => {
    const conflicts = getBindingConflicts(['mod', 't']);
    expect(conflicts.some((c) => c.type === 'browser' && c.label.includes('tab'))).toBe(true);
  });

  it('flags duplicate action bindings', () => {
    const bindings = mergeShortcutBindings();
    const conflicts = getBindingConflicts(['t'], {
      bindingsMap: bindings,
      excludeActionId: 'action-task',
    });
    expect(conflicts.some((c) => c.type === 'app')).toBe(false);
  });
});
