import { resolveRowValuesFromRecipient } from './indexedTemplateVariables';

/**
 * Validate audience + variable mapping before dispatch.
 */
export const computeAudienceHealthCheck = (
  recipients = [],
  templateIndices = [],
  variableMapping = {},
  availableColumns = []
) => {
  const issues = [];

  if (recipients.length === 0) {
    issues.push({ type: 'audience', severity: 'error', message: 'No recipients selected' });
    return { ok: false, issues, validCount: 0, invalidCount: 0 };
  }

  const missingMappings = templateIndices.filter(
    (i) => !(variableMapping[i] || variableMapping[String(i)])
  );
  if (missingMappings.length) {
    issues.push({
      type: 'mapping',
      severity: 'error',
      message: `Map variables: ${missingMappings.map((i) => `{${i}}`).join(', ')}`,
    });
  }

  for (const idx of templateIndices) {
    const col = variableMapping[idx] || variableMapping[String(idx)];
    if (!col) continue;
    if (!availableColumns.includes(col)) {
      issues.push({
        type: 'column',
        severity: 'error',
        message: `Column "${col}" for {${idx}} is not in audience data`,
      });
      continue;
    }
    let emptyCount = 0;
    recipients.forEach((r) => {
      const vals = resolveRowValuesFromRecipient(r, { [idx]: col });
      const v = vals[idx] ?? vals[String(idx)];
      if (v === undefined || v === null || String(v).trim() === '') emptyCount += 1;
    });
    if (emptyCount > 0) {
      issues.push({
        type: 'empty',
        severity: 'warn',
        message: `{${idx}} → "${col}": ${emptyCount} of ${recipients.length} row(s) empty`,
      });
    }
  }

  const invalidCount = recipients.filter((r) => r.status === 'Invalid').length;
  const validCount = recipients.length - invalidCount;

  return {
    ok: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
    validCount,
    invalidCount,
  };
};
