const INDEXED_VAR_RE = /\{(\d+)\}/g;

/** Normalize braces so typed {1} and HTML-encoded forms all match. */
export const decodeVariableEntities = (text) => (text || '')
  .replace(/&#123;/g, '{')
  .replace(/&#125;/g, '}')
  .replace(/&lbrace;/gi, '{')
  .replace(/&rbrace;/gi, '}')
  .replace(/\uFF5B/g, '{')
  .replace(/\uFF5D/g, '}');

/** Strip tags Quill may insert between `{` and digits. */
const coalesceSplitVariableMarkup = (html) => (html || '')
  .replace(/\{(?:\s*<[^>]*>\s*)+(\d+)\}/g, '{$1}')
  .replace(/(?:<[^>]*>\s*)*\{(\d+)\}/g, '{$1}');

export const parseIndexedVariables = (text) => {
  const indices = new Set();
  const str = decodeVariableEntities(coalesceSplitVariableMarkup(text));
  const re = new RegExp(INDEXED_VAR_RE.source, 'g');
  let match;
  while ((match = re.exec(str)) !== null) {
    indices.add(match[1]);
  }
  return Array.from(indices).sort((a, b) => Number(a) - Number(b));
};

/** Parse variables from Quill HTML, raw HTML, or plain subject text. */
export const parseIndexedVariablesFromHtml = (html) => {
  const indices = new Set(parseIndexedVariables(html));
  const decoded = decodeVariableEntities(coalesceSplitVariableMarkup(html || ''));
  let plain = decoded.replace(/<[^>]+>/g, '');
  if (typeof document !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(decoded, 'text/html');
      plain = doc.body.textContent || plain;
    } catch {
      /* keep stripped html */
    }
  }
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

export const previewWithDummyValues = (text, dummyValues = {}) => {
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

export const normalizeRowData = (rowData) => {
  if (!rowData || typeof rowData !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(rowData)) {
    out[String(k).toLowerCase().trim()] = v != null ? String(v) : '';
  }
  return out;
};

export const resolveRowValuesFromRecipient = (recipient, variableMapping = {}) => {
  const normalized = normalizeRowData(recipient?.rowData);
  const values = {};
  for (const [index, column] of Object.entries(variableMapping)) {
    const col = String(column).toLowerCase().trim();
    if (col === 'email') values[index] = recipient?.email || '';
    else if (col === 'name') values[index] = (recipient?.name || normalized.name || '').trim();
    else values[index] = normalized[col] ?? '';
  }
  return values;
};

export const getEffectiveTemplateContent = (template) => {
  if (!template) return '';
  if (template.approvedContent) return template.approvedContent;
  return template.content || '';
};

export const leadToRowData = (lead) => {
  if (!lead) return {};
  const keys = [
    'name', 'email', 'phone', 'city', 'leadStatus', 'callStatus', 'source',
    'artistType', 'primaryRole', 'learningGoal', 'exlyOfferingTitle',
  ];
  const out = {};
  for (const k of keys) {
    if (lead[k] != null && String(lead[k]).trim() !== '') out[k] = String(lead[k]).trim();
  }
  return out;
};

export const nextVariableIndex = (content) => {
  const vars = parseIndexedVariablesFromHtml(content);
  if (!vars.length) return 1;
  return Math.max(...vars.map(Number)) + 1;
};

export const insertIndexedVariable = (html, index) => {
  const token = `{${index}}`;
  return `${html || ''}${token}`;
};

export const collectAvailableColumns = (recipients) => {
  const cols = new Set(['name', 'email']);
  for (const r of recipients) {
    const rd = normalizeRowData(r?.rowData);
    Object.keys(rd).forEach((k) => cols.add(k));
  }
  return Array.from(cols).sort((a, b) => {
    if (a === 'name') return -1;
    if (b === 'name') return 1;
    if (a === 'email') return -1;
    if (b === 'email') return 1;
    return a.localeCompare(b);
  });
};
