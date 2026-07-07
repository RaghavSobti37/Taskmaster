import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Globe, RefreshCw, Trash2, Wand2 } from 'lucide-react';
import axios from 'axios';
import { Button, Input, Badge } from '../../components/ui';

function CopyBlock({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">{label}</p>
      <div className="flex gap-2">
        <code className="flex-1 text-xs break-all p-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] font-mono">
          {value}
        </code>
        <Button type="button" variant="secondary" size="sm" className="shrink-0 gap-1" onClick={copy}>
          <Copy size={14} />
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}

export default function WebsiteFormsPanel({ apiOrigin }) {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [origins, setOrigins] = useState('');
  const [agentPrompt, setAgentPrompt] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);

  const base = (apiOrigin || window.location.origin).replace(/\/$/, '');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/forms');
      setForms(data.forms || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createForm = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const allowedOrigins = origins.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
      await axios.post('/api/forms', { name: name.trim(), allowedOrigins });
      setName('');
      setOrigins('');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const loadPrompt = async (id) => {
    const { data } = await axios.get(`/api/forms/${id}/agent-prompt`);
    setAgentPrompt(data.prompt || '');
    setSelectedId(id);
  };

  const rotateKey = async (id) => {
    setBusy(true);
    try {
      await axios.post(`/api/forms/${id}/rotate-key`);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const testForm = async (id) => {
    setBusy(true);
    try {
      await axios.post(`/api/forms/${id}/test`);
    } finally {
      setBusy(false);
    }
  };

  const removeForm = async (id) => {
    setBusy(true);
    try {
      await axios.delete(`/api/forms/${id}`);
      if (selectedId === id) {
        setSelectedId(null);
        setAgentPrompt('');
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  const selected = forms.find((f) => f._id === selectedId);

  const embedSnippet = selected
    ? `<form id="contact-form">
  <input name="name" required placeholder="Name" />
  <input name="email" type="email" placeholder="Email" />
  <input name="phone" type="tel" placeholder="Phone" />
  <textarea name="message" placeholder="Message"></textarea>
  <button type="submit">Send</button>
</form>
<script src="${base}/embed/coreknot-form.js" data-form-key="${selected.publishableKey}" data-target="#contact-form"></script>`
    : '';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          className="flex-1 min-h-[44px]"
          placeholder="Form name (e.g. Marketing site)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          className="flex-1 min-h-[44px] font-mono text-xs"
          placeholder="Allowed origins (comma or newline)"
          value={origins}
          onChange={(e) => setOrigins(e.target.value)}
        />
        <Button type="button" className="min-h-[44px] shrink-0" disabled={busy || !name.trim()} onClick={createForm}>
          Create form
        </Button>
      </div>
      <p className="text-[11px] text-[var(--color-text-muted)]">
        Example origin: <code className="font-mono">https://yoursite.com</code> or <code className="font-mono">http://localhost:3000</code>
      </p>

      {loading ? (
        <p className="text-xs text-[var(--color-text-muted)]">Loading forms…</p>
      ) : forms.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">No website forms yet.</p>
      ) : (
        <ul className="space-y-2">
          {forms.map((f) => (
            <li
              key={f._id}
              className={`rounded-lg border p-3 ${
                selectedId === f._id
                  ? 'border-[var(--color-action-primary)]/50 bg-[var(--color-action-primary)]/5'
                  : 'border-[var(--color-bg-border)]'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <button type="button" className="text-left" onClick={() => loadPrompt(f._id)}>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{f.name}</p>
                  <p className="text-[11px] font-mono text-[var(--color-text-muted)] mt-0.5">{f.keyPrefix}…</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(f.allowedOrigins || []).map((o) => (
                      <Badge key={o} variant="neutral" className="text-[10px] font-mono">{o}</Badge>
                    ))}
                  </div>
                </button>
                <div className="flex gap-1 shrink-0">
                  <button type="button" className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)]" title="Agent prompt" onClick={() => loadPrompt(f._id)}>
                    <Wand2 size={14} />
                  </button>
                  <button type="button" className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)]" title="Test submit" onClick={() => testForm(f._id)}>
                    <Globe size={14} />
                  </button>
                  <button type="button" className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)]" title="Rotate key" onClick={() => rotateKey(f._id)}>
                    <RefreshCw size={14} />
                  </button>
                  <button type="button" className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10" title="Delete" onClick={() => removeForm(f._id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {selected && embedSnippet ? (
        <div className="space-y-3 pt-2 border-t border-[var(--color-bg-border)]">
          <CopyBlock label="Embed snippet" value={embedSnippet} />
          <CopyBlock label="Publishable key (browser-safe)" value={selected.publishableKey} />
          {agentPrompt ? <CopyBlock label="LLM agent setup prompt" value={agentPrompt} /> : null}
        </div>
      ) : null}
    </div>
  );
}
