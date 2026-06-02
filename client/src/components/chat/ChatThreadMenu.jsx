import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Link2 } from 'lucide-react';

const ChatThreadMenu = ({
  open,
  onClose,
  anchorRef,
  canRename,
  canEditLinks,
  onRename,
  onEditLinks,
}) => {
  const menuRef = useRef(null);
  const [style, setStyle] = React.useState(null);

  useEffect(() => {
    if (!open || !anchorRef?.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const menuWidth = 220;
    let left = rect.right - menuWidth;
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
    setStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left,
      width: menuWidth,
      zIndex: 99999,
    });
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (menuRef.current?.contains(e.target) || anchorRef?.current?.contains(e.target)) return;
      onClose?.();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !style) return null;
  if (!canRename && !canEditLinks) return null;

  const Item = ({ icon: Icon, label, onClick }) => (
    <button
      type="button"
      onClick={() => {
        onClick?.();
        onClose?.();
      }}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)]"
    >
      <Icon size={16} className="text-[var(--color-text-muted)] shrink-0" />
      {label}
    </button>
  );

  const panel = (
    <div
      ref={menuRef}
      style={style}
      className="rounded-[var(--radius-lg)] border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] shadow-lg p-1"
      role="menu"
    >
      {canRename && <Item icon={Pencil} label="Rename channel" onClick={onRename} />}
      {canEditLinks && <Item icon={Link2} label="Linked projects" onClick={onEditLinks} />}
    </div>
  );

  return createPortal(panel, document.body);
};

export default ChatThreadMenu;
