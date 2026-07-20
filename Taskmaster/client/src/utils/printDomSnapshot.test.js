import { afterEach, describe, expect, it, vi } from 'vitest';
import { printDomSnapshot } from './printDomSnapshot';

describe('printDomSnapshot', () => {
  const originalOpen = window.open;

  afterEach(() => {
    window.open = originalOpen;
    vi.restoreAllMocks();
  });

  it('prints a cloned DOM node without document.write string injection', () => {
    const source = document.createElement('section');
    source.textContent = 'Report body';
    const printDoc = document.implementation.createHTMLDocument('');
    const write = vi.spyOn(printDoc, 'write');
    const print = vi.fn();
    window.open = vi.fn(() => ({ document: printDoc, print }));

    const result = printDomSnapshot({
      title: 'Report <img src=x onerror=alert(1)>',
      contentNode: source,
    });

    expect(result).toBe(true);
    expect(write).not.toHaveBeenCalled();
    expect(printDoc.title).toBe('Report <img src=x onerror=alert(1)>');
    expect(printDoc.body.textContent).toBe('Report body');
    expect(print).toHaveBeenCalledTimes(1);
  });
});
