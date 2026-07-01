import { isShortcutRecordingActive } from './shortcutRecordingBridge';

/** Any modal/drawer/sheet using aria-modal (ModalShell, FullScreenWorkspace, filter panels, etc.) */
export function isAriaModalOpen(doc = document) {
  return Boolean(doc.querySelector('[aria-modal="true"]'));
}

/** Open NexusDropdown / desktop popper menu (not hidden). */
export function isOpenDropdownMenu(doc = document) {
  const menus = doc.querySelectorAll('.t-dropdown[data-origin]');
  for (const menu of menus) {
    if (menu.style.visibility !== 'hidden') return true;
  }
  return false;
}

export function isMultilineTextInput(target) {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  if (tag === 'textarea') return true;
  if (target.isContentEditable) return true;
  if (typeof target.closest === 'function' && target.closest('[contenteditable="true"]')) return true;
  return false;
}

export function isDatePickerInput(target) {
  if (!target || target.tagName?.toLowerCase() !== 'input') return false;
  const type = (target.type || 'text').toLowerCase();
  return ['date', 'datetime-local', 'month', 'week', 'time'].includes(type);
}

/**
 * Whether global Escape → history back should be suppressed.
 * Modal ESC is handled in capture phase by ModalShell before this runs.
 */
export function shouldBlockEscapeBack(event, doc = document) {
  if (event?.key !== 'Escape') return true;
  if (event.defaultPrevented) return true;
  if (isShortcutRecordingActive()) return true;
  if (isAriaModalOpen(doc)) return true;
  if (isOpenDropdownMenu(doc)) return true;
  if (isMultilineTextInput(event.target)) return false;
  if (isDatePickerInput(event.target)) return true;
  return false;
}
