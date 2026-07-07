import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button, Input } from '../../components/ui';

export default function IntegrationDetailDrawer({
  open,
  connection,
  provider,
  onClose,
  onSave,
  onSync,
  saving,
  syncing,
}) {
  const [syncOut, setSyncOut] = useState(connection?.metadata?.syncOut === true);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState(connection?.metadata?.spreadsheetUrl || connection?.metadata?.spreadsheetId || '');
  const [sheetName, setSheetName] = useState(connection?.metadata?.sheetName || 'Sheet1');
  const [colName, setColName] = useState(connection?.metadata?.columnMap?.name || 'name');
  const [colEmail, setColEmail] = useState(connection?.metadata?.columnMap?.email || 'email');
  const [colPhone, setColPhone] = useState(connection?.metadata?.columnMap?.phone || 'phone');
  const [defaultCampaign, setDefaultCampaign] = useState(connection?.metadata?.defaultCampaign || '');

  useEffect(() => {
    if (!connection) return;
    setSyncOut(connection.metadata?.syncOut === true);
    setSpreadsheetUrl(connection.metadata?.spreadsheetUrl || connection.metadata?.spreadsheetId || '');
    setSheetName(connection.metadata?.sheetName || 'Sheet1');
    setColName(connection.metadata?.columnMap?.name || 'name');
    setColEmail(connection.metadata?.columnMap?.email || 'email');
    setColPhone(connection.metadata?.columnMap?.phone || 'phone');
    setDefaultCampaign(connection.metadata?.defaultCampaign || '');
  }, [connection]);

  if (!open || !connection) return null;

  const isSheets = provider?.id === 'google_sheets';
  const isAisensy = provider?.id === 'aisensy';
  const isCrm = provider?.category === 'crm';

  const handleSave = () => {
    const metadata = { ...connection.metadata, syncOut };
    if (isSheets) {
      metadata.spreadsheetUrl = spreadsheetUrl.trim();
      metadata.sheetName = sheetName.trim() || 'Sheet1';
      metadata.columnMap = { name: colName, email: colEmail, phone: colPhone };
    }
    if (isAisensy) {
      metadata.defaultCampaign = defaultCampaign.trim();
    }
    onSave({ metadata });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="w-full max-w-md h-full bg-[var(--color-bg-primary)] border-l border-[var(--color-bg-border)] p-5 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black uppercase tracking-wider">{provider?.name || connection.provider} settings</h2>
          <button type="button" onClick={onClose} className="p-2 min-h-[44px] min-w-[44px]" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {connection.externalAccountId ? (
          <p className="text-xs text-[var(--color-text-muted)] mb-4">
            Account: <span className="font-mono text-[var(--color-text-secondary)]">{connection.externalAccountId}</span>
          </p>
        ) : null}

        {connection.metadata?.inboundPath ? (
          <div className="mb-4 p-3 rounded-lg border text-xs">
            <p className="font-semibold mb-1">Inbound URL</p>
            <code className="break-all">{connection.metadata.inboundPath}</code>
          </div>
        ) : null}

        {isAisensy ? (
          <div className="space-y-3 mb-4 text-sm">
            {connection.metadata?.webhookUrl ? (
              <div className="p-3 rounded-lg border text-xs">
                <p className="font-semibold mb-1">Webhook URL (paste in AiSensy)</p>
                <code className="break-all">{connection.metadata.webhookUrl}</code>
              </div>
            ) : null}
            <label className="block text-xs font-semibold">
              Default campaign name
              <Input
                className="mt-1 min-h-[44px] font-mono text-xs"
                value={defaultCampaign}
                onChange={(e) => setDefaultCampaign(e.target.value)}
                placeholder="e.g. call_completed"
              />
            </label>
            <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
              Campaign names must match templates created in AiSensy. Delivery status syncs to Data Hub when webhook is configured.
            </p>
          </div>
        ) : null}

        {isSheets ? (
          <div className="space-y-3 mb-4 text-sm">
            <label className="block text-xs font-semibold">
              Spreadsheet URL or ID
              <Input
                className="mt-1 min-h-[44px] font-mono text-xs"
                value={spreadsheetUrl}
                onChange={(e) => setSpreadsheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
              />
            </label>
            <label className="block text-xs font-semibold">
              Sheet tab name
              <Input
                className="mt-1 min-h-[44px]"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
              />
            </label>
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Column headers or letters</p>
            <div className="grid grid-cols-3 gap-2">
              <Input value={colName} onChange={(e) => setColName(e.target.value)} placeholder="name" />
              <Input value={colEmail} onChange={(e) => setColEmail(e.target.value)} placeholder="email" />
              <Input value={colPhone} onChange={(e) => setColPhone(e.target.value)} placeholder="phone" />
            </div>
            {onSync ? (
              <Button type="button" variant="secondary" className="w-full min-h-[44px]" disabled={syncing} onClick={onSync}>
                {syncing ? 'Syncing…' : 'Sync now'}
              </Button>
            ) : null}
          </div>
        ) : null}

        {isCrm ? (
          <label className="flex items-center gap-2 text-sm mb-4">
            <input
              type="checkbox"
              checked={syncOut}
              onChange={(e) => setSyncOut(e.target.checked)}
            />
            Push new CoreKnot leads to {provider.name}
          </label>
        ) : null}

        <button
          type="button"
          disabled={saving}
          className="w-full py-2 min-h-[44px] rounded-lg bg-[var(--color-action-primary)] text-white text-xs font-bold uppercase"
          onClick={handleSave}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
