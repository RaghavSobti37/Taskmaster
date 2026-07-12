const INDEXED_VAR_RE = /\{(\d+)\}/g;

const decodeVariableEntities = (text) => (text || '')
  .replace(/&#123;/g, '{')
  .replace(/&#125;/g, '}')
  .replace(/&lbrace;/gi, '{')
  .replace(/&rbrace;/gi, '}')
  .replace(/\uFF5B/g, '{')
  .replace(/\uFF5D/g, '}');

const coalesceSplitVariableMarkup = (html) => (html || '')
  .replace(/\{(?:\s*<[^>]*>\s*)+(\d+)\}/g, '{$1}')
  .replace(/(?:<[^>]*>\s*)*\{(\d+)\}/g, '{$1}');

const parseIndexedVariables = (text) => {
  const indices = new Set();
  const str = decodeVariableEntities(coalesceSplitVariableMarkup(text));
  const re = new RegExp(INDEXED_VAR_RE.source, 'g');
  let match;
  while ((match = re.exec(str)) !== null) {
    indices.add(match[1]);
  }
  return Array.from(indices).sort((a, b) => Number(a) - Number(b));
};

const parseIndexedVariablesFromHtml = (html) => {
  const indices = new Set(parseIndexedVariables(html));
  const decoded = decodeVariableEntities(coalesceSplitVariableMarkup(html || ''));
  const plain = decoded.replace(/<[^>]+>/g, '');
  parseIndexedVariables(plain).forEach((i) => indices.add(i));
  return Array.from(indices).sort((a, b) => Number(a) - Number(b));
};

const applyIndexedVariables = (text, values = {}) => {
  if (!text) return text;
  const decoded = decodeVariableEntities(coalesceSplitVariableMarkup(text));
  return decoded.replace(/\{(\d+)\}/g, (match, idx) => {
    const v = values[idx] ?? values[String(idx)];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
    return match;
  });
};

const previewWithDummyValues = (text, dummyValues = {}) => {
  if (!text) return text;
  const decoded = decodeVariableEntities(coalesceSplitVariableMarkup(text));
  return decoded.replace(/\{(\d+)\}/g, (match, idx) => {
    const d = dummyValues[idx] ?? dummyValues[String(idx)];
    if (d !== undefined && d !== null && String(d).trim() !== '') return `[${String(d).trim()}]`;
    return `[${idx}]`;
  });
};

const validateVariableMapping = (texts, mapping = {}) => {
  const indices = new Set();
  for (const t of texts) {
    parseIndexedVariablesFromHtml(t).forEach((i) => indices.add(i));
  }
  const missing = Array.from(indices).filter((i) => {
    const col = mapping[i] ?? mapping[String(i)];
    return !col || !String(col).trim();
  });
  return { ok: missing.length === 0, missing };
};

const normalizeRowDataMap = (rowData) => {
  if (!rowData || typeof rowData !== 'object') return {};
  const raw = rowData instanceof Map ? Object.fromEntries(rowData.entries()) : rowData;
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    out[String(k).toLowerCase().trim()] = v != null ? String(v) : '';
  }
  return out;
};

const resolveRowValues = (recipient, variableMapping = {}) => {
  const normalized = normalizeRowDataMap(recipient?.rowData);
  const values = {};
  for (const [index, column] of Object.entries(variableMapping)) {
    const col = String(column).toLowerCase().trim();
    if (col === 'email') values[index] = recipient?.email || '';
    else if (col === 'name') values[index] = (recipient?.name || normalized.name || '').trim();
    else values[index] = normalized[col] ?? '';
  }
  return values;
};

const getEffectiveTemplateContent = (template) => {
  if (!template) return '';
  const content = template.content || '';
  const approved = template.approvedContent || '';
  if (template.format === 'rawHtml' && content.length > approved.length) return content;
  if (approved) return approved;
  return content;
};

const leadToRowData = (lead) => {
  if (!lead) return {};
  const doc = lead.toObject ? lead.toObject() : lead;
  const keys = [
    'name', 'email', 'phone', 'city', 'leadStatus', 'callStatus', 'source',
    'artistType', 'primaryRole', 'learningGoal', 'exlyOfferingTitle',
  ];
  const out = {};
  for (const k of keys) {
    if (doc[k] != null && String(doc[k]).trim() !== '') {
      out[k] = String(doc[k]).trim();
    }
  }
  return out;
};

module.exports = {
  parseIndexedVariables,
  parseIndexedVariablesFromHtml,
  applyIndexedVariables,
  previewWithDummyValues,
  validateVariableMapping,
  normalizeRowDataMap,
  resolveRowValues,
  getEffectiveTemplateContent,
  leadToRowData,
};
