import React, { useState } from 'react';
import { NexusModal, Button, SearchInput } from '../ui';
import { useUserDirectory } from '../../hooks/useTaskmasterQueries';
import { useAuth } from '../../contexts/AuthContext';

const NewDmModal = ({ open, onClose, onSelect, loading }) => {
  const { user } = useAuth();
  const { data: users = [] } = useUserDirectory();
  const [search, setSearch] = useState('');

  const filtered = users.filter((u) => {
    if (u._id === user?._id) return false;
    const q = search.toLowerCase();
    return !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  return (
    <NexusModal isOpen={open} onClose={onClose} title="New message" size="sm" showFooter={false}>
      <SearchInput value={search} onChange={setSearch} placeholder="Search team…" className="mb-3" />
      <div className="max-h-64 overflow-y-auto space-y-1">
        {filtered.slice(0, 25).map((u) => (
          <button
            key={u._id}
            type="button"
            disabled={loading}
            onClick={() => onSelect(u._id)}
            className="w-full text-left px-2 py-2 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[12px] flex items-center gap-2"
          >
            <div className="w-7 h-7 rounded-full bg-[var(--color-bg-workspace)] flex items-center justify-center text-[10px] font-bold overflow-hidden shrink-0">
              {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : u.name?.[0]}
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">{u.name}</p>
              <p className="text-[10px] text-[var(--color-text-muted)] truncate">{u.email}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </NexusModal>
  );
};

export default NewDmModal;
