import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import CKDropdown from '../../components/ui/CKDropdown';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, UserPlus, X, Briefcase, Tag, Hash, Palette } from 'lucide-react';
import { Badge, PageHeader, PageContainer, Card } from "../../components/ui";

const ProjectCreate = () => {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [tags, setTags] = useState([]);
  const [customTag, setCustomTag] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [users, setUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const PROJECT_COLORS = [
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#14b8a6', // teal
    '#06b6d4', // cyan
    '#64748b', // slate
  ];

  const predefinedTags = [
    { value: 'PR', label: 'PR' },
    { value: 'Editing', label: 'Editing' },
    { value: 'Marketing', label: 'Marketing' },
    { value: 'Sales', label: 'Sales' },
    { value: 'Design', label: 'Design' },
    { value: 'HR', label: 'HR' },
    { value: 'Finance', label: 'Finance' },
    { value: 'Tech', label: 'Tech' },
  ];

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get('/api/users/team');
        setUsers(res.data.team || []);
      } catch (err) {
        console.error('Error fetching users:', err);
      }
    };
    fetchUsers();
  }, []);

  const addMember = (userId) => {
    const user = users.find(u => u._id === userId);
    if (user && !members.find(m => m.userId === user._id)) {
      setMembers([...members, { userId: user._id, name: user.name, role: user.role, avatar: user.avatar }]);
    }
  };

  const removeMember = (userId) => {
    setMembers(members.filter(m => m.userId !== userId));
  };

  const handleAddCustomTag = (e) => {
    if (e.key === 'Enter' && customTag.trim()) {
      e.preventDefault();
      const trimmed = customTag.trim();
      if (!tags.includes(trimmed)) {
        setTags([...tags, trimmed]);
      }
      setCustomTag('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('/api/projects', { 
        name, 
        description: desc, 
        tags: tags,
        color,
        members: members.map(m => ({ userId: m.userId, role: m.role }))
      });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate('/projects');
    } catch (err) {
      console.error('Project creation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const dropdownTagOptions = React.useMemo(() => {
    const opts = [...predefinedTags];
    tags.forEach(tag => {
      if (!opts.some(o => o.value === tag)) {
        opts.push({ value: tag, label: tag });
      }
    });
    return opts;
  }, [tags]);

  const formatOptionLabel = ({ value, label }) => {
    const user = users.find(u => u._id === value);
    if (!user) return label;
    return (
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded bg-blue-500/10 flex items-center justify-center text-[10px] font-black text-blue-500 overflow-hidden">
          {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" alt="" /> : user.name.substring(0, 2).toUpperCase()}
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-bold text-[var(--color-text-primary)] leading-none mb-0.5">{user.name}</span>
          <span className="text-[8px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">{user.role}</span>
        </div>
      </div>
    );
  };

  return (
    <PageContainer maxWidth="1000px">
      <PageHeader
        title="Create New Project"
        subtitle="Set up your project and add team members."
        icon={Briefcase}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Project Name</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none font-black text-sm uppercase tracking-tight"
                placeholder="Enter project name"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Tags</label>
              <CKDropdown
                multi
                options={dropdownTagOptions}
                value={tags}
                onChange={setTags}
                placeholder="Select tags..."
              />
              <input 
                type="text"
                value={customTag}
                onChange={e => setCustomTag(e.target.value)}
                onKeyDown={handleAddCustomTag}
                placeholder="+ Add Custom Tag"
                className="w-full mt-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-transparent border-b border-[var(--color-bg-border)] focus:border-[var(--color-action-primary)] outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1 flex items-center gap-1.5"><Palette size={12} /> Project Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {PROJECT_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-all duration-200 ${color === c ? 'ring-2 ring-offset-2 ring-offset-[var(--color-bg-workspace)] scale-110 ring-[var(--color-text-primary)]' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              <span className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1" style={{ color }}>{color}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Description</label>
            <textarea 
              value={desc}
              onChange={e => setDesc(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none min-h-[120px] text-sm font-medium"
              placeholder="Describe what this project is about..."
            />
          </div>
        </Card>

        <Card className="p-8 space-y-6">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Team Members</label>
            <Badge variant="todo">{members.length} ADDED</Badge>
          </div>

          <div className="space-y-6">
            <CKDropdown
              options={users.map(u => ({ value: u._id, label: u.name }))}
              value=""
              onChange={addMember}
              placeholder="Search team members..."
              renderOption={formatOptionLabel}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {members.map((m) => (
                <div key={m.userId} className="flex items-center justify-between p-3 bg-[var(--color-bg-workspace)] rounded-xl border border-[var(--color-bg-border)] group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] flex items-center justify-center font-black text-[10px] text-blue-500 uppercase overflow-hidden">
                      {m.avatar ? <img src={m.avatar} className="w-full h-full object-cover" alt="" /> : m.name.substring(0, 2)}
                    </div>
                    <div>
                      <p className="font-black text-xs uppercase tracking-tight text-[var(--color-text-primary)]">{m.name}</p>
                      <p className="text-[8px] font-black uppercase text-[var(--color-text-muted)] tracking-[0.2em]">{m.role}</p>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => removeMember(m.userId)}
                    className="p-1.5 hover:text-red-500 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {members.length === 0 && (
                <div className="col-span-full py-12 text-center border-2 border-dashed border-[var(--color-bg-border)] rounded-2xl opacity-30">
                  <UserPlus size={32} className="mx-auto text-[var(--color-text-muted)] mb-3" />
                  <p className="text-[10px] font-black uppercase tracking-widest">No Members Added</p>
                </div>
              )}
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-4">
          <button 
            type="button" 
            onClick={() => navigate('/projects')}
            className="px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface)] transition-all"
          >
            Cancel
          </button>
          <button 
            type="submit"
            disabled={loading || !name}
            className="bg-[var(--color-action-primary)] text-white px-10 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[var(--color-action-hover)] disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
          >
             {loading ? 'Creating...' : <><Plus size={18} /> Create Project</>}
          </button>
        </div>
      </form>
    </PageContainer>
  );
};

export default ProjectCreate;
