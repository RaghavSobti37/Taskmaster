import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Trap focus inside a modal/dialog while open; restore focus on close.
 */
export function useFocusTrap(isActive, containerRef) {
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!isActive || !containerRef?.current) return undefined;

    previousFocusRef.current = document.activeElement;
    const container = containerRef.current;

    const getFocusable = () =>
      [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
        (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
      );

    const focusTimer = window.setTimeout(() => {
      const nodes = getFocusable();
      (nodes[0] || container).focus?.();
    }, 0);

    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      const nodes = getFocusable();
      if (!nodes.length) {
        e.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      container.removeEventListener('keydown', onKeyDown);
      const prev = previousFocusRef.current;
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
        prev.focus();
      }
    };
  }, [isActive, containerRef]);
}
