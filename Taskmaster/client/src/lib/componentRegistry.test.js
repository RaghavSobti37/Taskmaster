import { describe, it, expect } from 'vitest';
import { getRecommendedTemplateId, getDefaultLayoutElements, LAYOUT_TEMPLATES } from '../lib/componentRegistry';

describe('componentRegistry', () => {
  it('maps department presets to existing layout templates', () => {
    const presets = ['sales', 'operations', 'admin', 'artist-management', 'standard', undefined];
    for (const preset of presets) {
      const id = getRecommendedTemplateId(preset);
      expect(LAYOUT_TEMPLATES.some((t) => t.id === id)).toBe(true);
    }
  });

  it('coreknot template prioritizes daily-action widgets on row 1', () => {
    const coreknot = LAYOUT_TEMPLATES.find((t) => t.id === 'coreknot');
    const row1 = coreknot?.elements.filter((e) => e.row === 1).map((e) => e.componentId) || [];
    expect(row1).toContain('mark-attendance');
    expect(row1).toContain('schedule');
    expect(row1).toContain('todos-today');
    expect(row1).toContain('todos-overdue');
    const ids = coreknot?.elements.map((e) => e.componentId) || [];
    expect(ids).not.toContain('notes');
    expect(ids).not.toContain('pinboard');
    expect(ids).not.toContain('daily-missions');
  });

  it('getDefaultLayoutElements returns tiered v2 layout with section metadata', () => {
    const elements = getDefaultLayoutElements('standard');
    expect(elements.length).toBeGreaterThan(0);
    expect(elements.every((e) => e.section)).toBe(true);
    const visible = elements.filter((e) => e.visible !== false);
    const hidden = elements.filter((e) => e.visible === false);
    expect(visible.some((e) => e.componentId === 'mark-attendance')).toBe(true);
    expect(visible.some((e) => e.componentId === 'schedule')).toBe(true);
    expect(hidden.some((e) => e.componentId === 'notes')).toBe(true);
    expect(hidden.some((e) => e.componentId === 'pinboard')).toBe(true);
  });

  it('sales-command template omits stub booked-calls and followups-today', () => {
    const sales = LAYOUT_TEMPLATES.find((t) => t.id === 'sales-command');
    const ids = sales?.elements.map((e) => e.componentId) || [];
    expect(ids).not.toContain('booked-calls');
    expect(ids).not.toContain('followups-today');
  });
});
