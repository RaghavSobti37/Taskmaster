import React from 'react';
import { Hash } from 'lucide-react';

const userRoleLabel = (user) => {
  if (!user) return '';
  const dept = user.departmentId?.name || user.department?.name;
  if (dept) return dept;
  if (Array.isArray(user.teams) && user.teams[0]) return user.teams[0];
  return '';
};

const UserAvatar = ({ user, size = 28 }) => {
  const name = user?.name || '?';
  const initial = name.charAt(0).toUpperCase();
  if (user?.avatar) {
    return (
      <img
        src={user.avatar}
        alt=""
        className="rounded-full object-cover shrink-0 border border-[var(--color-bg-border)]"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] text-[var(--color-text-secondary)]"
      style={{ width: size, height: size }}
    >
      {initial}
    </span>
  );
};

const AssetThumb = ({ asset }) => (
  <span className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center bg-[var(--color-action-primary)]/12 border border-[var(--color-action-primary)]/25 text-[var(--color-action-primary)]">
    <Hash size={14} />
  </span>
);

const MentionAutocompleteMenu = ({
  menu,
  menuItems = [],
  users = [],
  assets = [],
  menuPlacement = 'below',
  onPick,
  assetsError = false,
}) => {
  if (!menu) return null;

  const placementClass =
    menuPlacement === 'above' ? 'bottom-full mb-1' : 'top-full mt-1';

  const resolveMeta = (item) => {
    if (menu.type === 'user') {
      const user = users.find((u) => u._id === item.key);
      return { user, role: userRoleLabel(user) };
    }
    const asset = assets.find((a) => a._id === item.key);
    const projects = (asset?.projectIds || [])
      .map((p) => (typeof p === 'object' ? p.name : null))
      .filter(Boolean)
      .join(', ');
    return {
      asset,
      role: asset?.type ? String(asset.type).replace(/_/g, ' ') : projects || 'Asset',
    };
  };

  return (
    <div
      className={`absolute z-50 left-0 right-0 max-h-52 overflow-y-auto rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] shadow-lg custom-scrollbar ${placementClass}`}
      role="listbox"
    >
      {menuItems.length === 0 ? (
        <p className="px-3 py-2.5 text-[11px] text-[var(--color-text-muted)]">
          {menu.type === 'asset'
            ? assetsError
              ? 'Could not load assets'
              : 'No assets match — add assets in Assets page'
            : 'No people match'}
        </p>
      ) : (
        menuItems.map((item) => {
          const { user, asset, role } = resolveMeta(item);
          return (
            <button
              key={item.key}
              type="button"
              role="option"
              className="w-full text-left px-2.5 py-2 flex items-center gap-2.5 hover:bg-[var(--color-bg-secondary)] transition-colors border-b border-[var(--color-bg-border)]/50 last:border-0"
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(item.insert);
              }}
            >
              {menu.type === 'user' ? (
                <UserAvatar user={user} />
              ) : (
                <AssetThumb asset={asset} />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold text-[var(--color-text-primary)] truncate">
                  {menu.type === 'user' ? (
                    item.label
                  ) : (
                    <span className="inline-flex items-center gap-0.5">
                      <span className="text-[var(--color-action-primary)]">#</span>
                      {item.label}
                    </span>
                  )}
                </span>
                {role ? (
                  <span className="block text-[10px] text-[var(--color-text-muted)] truncate capitalize">
                    {role}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
};

export default MentionAutocompleteMenu;
