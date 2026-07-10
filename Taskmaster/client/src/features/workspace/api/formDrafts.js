import { localRun, localQuery } from '@coreknot/local-database';

export async function saveFormDraft(formId, payload) {
  await localRun(
    `INSERT INTO form_drafts (form_id, payload, last_modified_at)
     VALUES (?, ?, ?)
     ON CONFLICT(form_id) DO UPDATE SET
       payload = excluded.payload,
       last_modified_at = excluded.last_modified_at`,
    [formId, JSON.stringify(payload), Date.now()],
  );
}

export async function recoverFormDraft(formId) {
  const rows = await localQuery(
    'SELECT payload FROM form_drafts WHERE form_id = ?',
    [formId],
  );
  if (!rows[0]?.payload) return null;
  try {
    return JSON.parse(rows[0].payload);
  } catch {
    return null;
  }
}

export async function clearFormDraft(formId) {
  await localRun('DELETE FROM form_drafts WHERE form_id = ?', [formId]);
}
