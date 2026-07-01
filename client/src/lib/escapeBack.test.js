import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isAriaModalOpen,
  isOpenDropdownMenu,
  isMultilineTextInput,
  isDatePickerInput,
  shouldBlockEscapeBack,
} from './escapeBack';

describe('escapeBack', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('detects aria-modal overlays', () => {
    expect(isAriaModalOpen()).toBe(false);
    const dialog = document.createElement('div');
    dialog.setAttribute('aria-modal', 'true');
    document.body.appendChild(dialog);
    expect(isAriaModalOpen()).toBe(true);
  });

  it('detects open NexusDropdown menus', () => {
    const menu = document.createElement('div');
    menu.className = 't-dropdown';
    menu.dataset.origin = 'top-left';
    menu.style.visibility = 'visible';
    document.body.appendChild(menu);
    expect(isOpenDropdownMenu()).toBe(true);

    menu.style.visibility = 'hidden';
    expect(isOpenDropdownMenu()).toBe(false);
  });

  it('identifies multiline inputs', () => {
    expect(isMultilineTextInput({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isMultilineTextInput({ tagName: 'INPUT' })).toBe(false);
    expect(isMultilineTextInput({
      tagName: 'DIV',
      isContentEditable: true,
      closest: () => null,
    })).toBe(true);
  });

  it('identifies date picker inputs', () => {
    expect(isDatePickerInput({ tagName: 'INPUT', type: 'date' })).toBe(true);
    expect(isDatePickerInput({ tagName: 'INPUT', type: 'text' })).toBe(false);
  });

  it('blocks escape back when modal is open', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('aria-modal', 'true');
    document.body.appendChild(dialog);
    const event = { key: 'Escape', defaultPrevented: false, target: document.body };
    expect(shouldBlockEscapeBack(event)).toBe(true);
  });

  it('allows escape back on plain page', () => {
    const event = { key: 'Escape', defaultPrevented: false, target: document.body };
    expect(shouldBlockEscapeBack(event)).toBe(false);
  });

  it('blocks escape back for date inputs', () => {
    const input = document.createElement('input');
    input.type = 'date';
    const event = { key: 'Escape', defaultPrevented: false, target: input };
    expect(shouldBlockEscapeBack(event)).toBe(true);
  });
});
