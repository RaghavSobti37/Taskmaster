import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSidebar } from '../contexts/SidebarContext';
import { shouldBlockEscapeBack } from '../lib/escapeBack';

/**
 * Global Escape → browser history back when no overlay consumes ESC first.
 * Call from app shell (KeyboardShortcutsProvider). Modals use capture-phase ESC in ModalShell.
 *
 * @param {{ blocked?: () => boolean }} [options]
 */
export function useEscapeBack({ blocked } = {}) {
  const navigate = useNavigate();
  const { isMobileOpen } = useSidebar();
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (blockedRef.current?.()) return;
      if (isMobileOpen) return;
      if (shouldBlockEscapeBack(e)) return;

      e.preventDefault();
      navigate(-1);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, isMobileOpen]);
}
