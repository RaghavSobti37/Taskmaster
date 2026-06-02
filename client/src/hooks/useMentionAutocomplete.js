import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { useUserDirectory } from './useTaskmasterQueries';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';

const fetchAssets = async () => {
  const { data } = await axios.get('/api/assets', {
    headers: { 'x-skip-toast': 'true' },
  });
  return Array.isArray(data) ? data : [];
};

const detectTrigger = (text, cursor) => {
  const slice = text.slice(0, cursor);
  const userMatch = slice.match(/(?:^|\s)@([^\s@#]*)$/);
  if (userMatch) {
    return { type: 'user', query: userMatch[1], start: cursor - userMatch[1].length - 1 };
  }
  const assetMatch = slice.match(/(?:^|\s)#([^@]*)$/);
  if (assetMatch) {
    const raw = assetMatch[1];
    const query = raw.trim();
    return { type: 'asset', query, start: cursor - raw.length - 1 };
  }
  return null;
};

/**
 * Shared @user / #asset autocomplete for MentionTextarea and MentionInput.
 */
export function useMentionAutocomplete({
  value = '',
  onChange,
  disabled = false,
  editSessionKey,
  multiline = true,
  forcePlain = false,
  mentionUsers = null,
}) {
  const inputRef = useRef(null);
  const { data: directoryUsers = [] } = useUserDirectory();
  const users = mentionUsers ?? directoryUsers;
  const { data: assets = [], isError: assetsError } = useQuery({
    queryKey: ['assets', 'mention-picker'],
    queryFn: fetchAssets,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const [menu, setMenu] = useState(null);
  const [isEditing, setIsEditing] = useState(() => !String(value).trim() || forcePlain);

  useEffect(() => {
    if (editSessionKey == null) return;
    setIsEditing(!String(value).trim() || forcePlain);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSessionKey]);

  useEffect(() => {
    const el = inputRef.current;
    if (el && document.activeElement === el) return;
    if (String(value).trim() && !forcePlain) setIsEditing(false);
  }, [value, forcePlain]);

  const menuItems = useMemo(() => {
    if (!menu) return [];
    const q = menu.query.toLowerCase();
    if (menu.type === 'user') {
      return users
        .filter((u) => !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
        .slice(0, 8)
        .map((u) => ({
          key: u._id,
          label: u.name,
          insert: `@${u.name?.split(/\s+/)[0] || u.name} `,
          meta: u,
        }));
    }
    return assets
      .filter((a) => !q || a.name?.toLowerCase().includes(q))
      .slice(0, 8)
      .map((a) => ({
        key: a._id,
        label: a.name,
        insert: `#${a.name} `,
        meta: a,
      }));
  }, [menu, users, assets]);

  const showMenu = Boolean(menu && (isEditing || forcePlain));

  const closeMenu = () => setMenu(null);

  const syncMenuFromEl = useCallback((el) => {
    if (!el) return;
    const trigger = detectTrigger(value, el.selectionStart ?? value.length);
    setMenu(trigger);
  }, [value]);

  const enterEdit = () => {
    if (disabled) return;
    setIsEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleFocus = () => {
    if (!disabled) setIsEditing(true);
  };

  const handleRichViewMouseDown = (e) => {
    if (e.target.closest('a[href]')) return;
    e.preventDefault();
    enterEdit();
  };

  const insertAtCursor = useCallback((insertText) => {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = value.slice(0, menu?.start ?? start);
    const after = value.slice(end);
    const next = `${before}${insertText}${after}`;
    onChange?.(next);
    closeMenu();
    requestAnimationFrame(() => {
      const pos = before.length + insertText.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }, [value, onChange, menu]);

  const handleChange = (e) => {
    const next = e.target.value;
    onChange?.(next);
    const trigger = detectTrigger(next, e.target.selectionStart);
    setMenu(trigger);
    if (!disabled) setIsEditing(true);
  };

  const handleKeyDown = (e) => {
    if (showMenu && menuItems.length > 0) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu();
        return;
      }
      if (e.key === 'Enter' && menuItems[0]) {
        e.preventDefault();
        insertAtCursor(menuItems[0].insert);
        return;
      }
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      closeMenu();
      if (!disabled && !forcePlain) setIsEditing(false);
    }, 150);
  };

  const showRichView = !forcePlain && !disabled && !isEditing && String(value).trim();
  const showDisabledRichView = !forcePlain && disabled && String(value).trim();

  return {
    inputRef,
    users,
    assets,
    assetsError,
    menu,
    menuItems,
    showMenu,
    isEditing,
    showRichView,
    showDisabledRichView,
    enterEdit,
    handleRichViewMouseDown,
    handleFocus,
    syncMenuFromEl,
    insertAtCursor,
    handleChange,
    handleKeyDown,
    handleBlur,
    closeMenu,
    multiline,
  };
}
