import { useEffect } from 'react';

/**
 * Register page-local keyboard shortcuts (merged with global provider).
 */
export function usePageShortcuts(bindings = [], enabled = true) {
  useEffect(() => {
    if (!enabled || !bindings.length || typeof window === 'undefined') return undefined;

    const onKeyDown = (event) => {
      if (event.defaultPrevented) return;
      const target = event.target;
      const tag = target?.tagName?.toLowerCase?.();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;

      for (const binding of bindings) {
        const key = String(binding.key || '').toLowerCase();
        const needsMeta = Boolean(binding.meta);
        const needsCtrl = Boolean(binding.ctrl);
        const needsShift = Boolean(binding.shift);
        if (event.key.toLowerCase() !== key) continue;
        if (needsMeta && !event.metaKey) continue;
        if (needsCtrl && !event.ctrlKey) continue;
        if (needsShift && !event.shiftKey) continue;
        if (binding.preventDefault !== false) event.preventDefault();
        binding.handler?.(event);
        break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [bindings, enabled]);
}
