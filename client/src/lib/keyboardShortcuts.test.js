import { describe, it, expect } from 'vitest';
import {
  resolveGChord,
  isTypingTarget,
  filterShortcutSections,
  SHORTCUT_SECTIONS,
  GLOBAL_G_CHORD_ROUTES,
} from './keyboardShortcuts';

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
    const filtered = filterShortcutSections(SHORTCUT_SECTIONS, { isAdmin: false });
    const nav = filtered.find((s) => s.title === 'Navigation');
    const ids = nav.items.map((i) => i.id);
    expect(ids).not.toContain('g-u');
    expect(ids).toContain('g-t');
  });

  it('covers core routes in registry', () => {
    expect(GLOBAL_G_CHORD_ROUTES.t.path).toBe('/todo');
    expect(GLOBAL_G_CHORD_ROUTES.n.path).toBe('/notes');
  });
});
