/**
 * Enter-key submit helpers for ModalShell / confirm dialogs.
 */

export function shouldSubmitModalOnEnter(target) {
  if (!target) return false;
  if (target.closest?.('[data-modal-enter-ignore]')) return false;
  if (target.tagName === 'TEXTAREA') return false;
  if (target.isContentEditable) return false;
  if (target.closest?.('[contenteditable="true"]')) return false;
  if (target.tagName === 'SELECT') return false;

  const form = target.closest?.('form');
  if (form && target.tagName === 'INPUT') {
    const type = (target.type || 'text').toLowerCase();
    if (!['button', 'submit', 'checkbox', 'radio', 'file'].includes(type)) {
      return false;
    }
  }

  return true;
}

export function triggerModalPrimarySubmit(panel) {
  if (!panel) return false;

  const form = panel.querySelector('form');
  if (form) {
    const submitBtn = form.querySelector(
      'button[type="submit"]:not([disabled]), input[type="submit"]:not([disabled])',
    );
    if (submitBtn) {
      submitBtn.click();
      return true;
    }
  }

  const primary = panel.querySelector('[data-modal-primary]');
  if (primary && !primary.disabled && primary.getAttribute('aria-disabled') !== 'true') {
    primary.click();
    return true;
  }

  return false;
}
