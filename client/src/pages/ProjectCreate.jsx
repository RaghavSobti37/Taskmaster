import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { Plus, UserPlus, X, Briefcase, Tag, Hash } from 'lucide-react';
import CKDropdown from '../components/ui/CKDropdown';

const ProjectCreate = () => {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [tags, setTags] = useState([]);
  const [customTag, setCustomTag] = useState('');
  const [users, setUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const roleOptions = [
    { value: 'lead', label: 'Lead Strategist' },
    { value: 'developer', label: 'System Developer' },
    { value: 'designer', label: 'UX Designer' },
    { value: 'qa', label: 'QA Engineer' },
    { value: 'member', label: 'Standard Operative' },
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
        setUsers(res.data);
      } catch (err) {
        console.error('Error fetching users:', err);
      }
    };
    fetchUsers();
  }, []);

  const addMember = (userOption) => {
    const user = users.find(u => u._id === userOption.value);
    if (!members.find(m => m.userId === user._id)) {
      setMembers([...members, { userId: user._id, name: user.name, role: 'member' }]);
    }
  };

  const removeMember = (userId) => {
    setMembers(members.filter(m => m.userId !== userId));
  };

  const updateRole = (userId, role) => {
    setMembers(members.map(m => m.userId === userId ? { ...m, role } : m));
  };

  const handleAddCustomTag = (e) => {
    if (e.key === 'Enter' && customTag.trim()) {
      e.preventDefault();
      if (!tags.find(t => t.value === customTag.trim())) {
        const newTag = { value: customTag.trim(), label: customTag.trim() };
        setTags([...tags, newTag]);
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
        tags: tags.map(t => t.value),
        members: members.map(m => ({ userId: m.userId, role: m.role }))
      });
      navigate('/projects');
    } catch (err) {
      console.error('Project creation error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Initialize Workspace</h1>
        <p className="text-[var(--color-text-secondary)]">Establish a new project nexus and assign initial operatives.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="bg-[var(--color-bg-surface)] rounded-3xl border border-[var(--color-bg-border)] shadow-sm overflow-hidden p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-widest ml-1">Project Identifier</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none font-bold"
                placeholder="e.g. Project Overlord"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-widest ml-1">Focus Tags</label>
              <Select
                isMulti
                options={predefinedTags}
                value={tags}
                onChange={setTags}
                placeholder="Select or type custom..."
                className="react-select-container"
                classNamePrefix="react-select"
              />
              <input 
                type="text"
                value={customTag}
                onChange={e => setCustomTag(e.target.value)}
                onKeyDown={handleAddCustomTag}
                placeholder="Press Enter for custom tag"
                className="w-full mt-2 px-4 py-2 text-xs bg-transparent border-b border-[var(--color-bg-border)] focus:border-[var(--color-action-primary)] outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-widest ml-1">Mission Briefing</label>
            <textarea 
              value={desc}
              onChange={e => setDesc(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none min-h-[100px]"
              placeholder="Describe the objectives and scope..."
            />
          </div>
        </section>

        <section className="bg-[var(--color-bg-surface)] rounded-3xl border border-[var(--color-bg-border)] shadow-sm overflow-hidden p-8 space-y-6">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-widest ml-1">Team Deployment</label>
            <span className="text-[10px] font-bold text-[var(--color-text-muted)]">{members.length} Operatives Assigned</span>
          </div>

          <div className="space-y-4">
            <Select
              options={users.map(u => ({ value: u._id, label: u.name }))}
              onChange={addMember}
              placeholder="Search operatives to recruit..."
              className="react-select-container"
              classNamePrefix="react-select"
            />

            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.userId} className="flex items-center justify-between p-3 bg-[var(--color-bg-workspace)] rounded-xl border border-[var(--color-bg-border)]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-surface)] flex items-center justify-center font-bold text-xs">
                      {m.name.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="font-bold text-sm">{m.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-4">
                      <CKDropdown 
                        options={roleOptions}
                        value={m.role}
                        onChange={(role) => updateRole(m.userId, role)}
                        className="w-48"
                        placeholder="Assign Role"
                      />
                    </div>
                    <button 
                      type="button" 
                      onClick={() => removeMember(m.userId)}
                      className="p-2 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {members.length === 0 && (
                <div className="py-8 text-center border-2 border-dashed border-[var(--color-bg-border)] rounded-2xl">
                  <UserPlus size={32} className="mx-auto text-[var(--color-text-muted)] mb-2" />
                  <p className="text-xs text-[var(--color-text-muted)]">No operatives assigned yet.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-4">
          <button 
            type="button" 
            onClick={() => navigate('/projects')}
            className="px-8 py-3 rounded-xl font-bold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] transition-all"
          >
            Cancel
          </button>
          <button 
            type="submit"
            disabled={loading || !name}
            className="bg-[var(--color-action-primary)] text-white px-10 py-3 rounded-xl font-bold hover:bg-[var(--color-action-hover)] disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
          >
            {loading ? 'Initializing...' : <><Briefcase size={20} /> Deploy Project</>}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProjectCreate;
