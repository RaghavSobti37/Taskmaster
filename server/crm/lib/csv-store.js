const fs = require('fs');
const path = require('path');
const { LEADS_HEADERS, EMI_HEADERS, AUDIT_HEADERS } = require('./schema');

const DATA_DIR = path.join(__dirname, '..', 'data');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function parseCsv(content) {
  const rows = [];
  let i = 0;
  const len = content.length;

  function readField() {
    let field = "";
    if (i < len && content[i] === '"') {
      i++;
      while (i < len) {
        if (content[i] === '"') {
          if (content[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          field += content[i];
          i++;
        }
      }
    } else {
      while (i < len && content[i] !== "," && content[i] !== "\n" && content[i] !== "\r") {
        field += content[i];
        i++;
      }
    }
    return field;
  }

  function skipDelim() {
    if (content[i] === "\r") i++;
    if (content[i] === "\n") i++;
  }

  while (i < len) {
    const row = [];
    while (i < len && content[i] !== "\n" && content[i] !== "\r") {
      row.push(readField());
      if (content[i] === ",") i++;
    }
    if (row.length > 0) rows.push(row);
    skipDelim();
  }

  if (rows.length < 2) return [];
  const h = rows[0].map((x) => x.trim());
  return rows.slice(1).map((vals) => {
    const obj = {};
    h.forEach((key, idx) => {
      obj[key] = vals[idx] ?? "";
    });
    return obj;
  });
}

function escape(val) {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n"))
    return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const LEADS_PATH = path.join(DATA_DIR, "leads.csv");

function getLeadsRaw() {
  ensureDir();
  if (!fs.existsSync(LEADS_PATH)) {
    fs.writeFileSync(LEADS_PATH, LEADS_HEADERS.join(",") + "\n", "utf8");
  }
  return fs.readFileSync(LEADS_PATH, "utf8");
}

function getLeads() {
  const content = getLeadsRaw();
  const rows = parseCsv(content);
  return rows.map((r, i) => ({ ...r, row_index: i + 2 }));
}

function getLeadByRowIndex(rowIndex) {
  const rows = getLeads();
  const idx = rowIndex - 2;
  if (idx < 0 || idx >= rows.length) return null;
  return rows[idx];
}

function appendLead(row) {
  ensureDir();
  const line = LEADS_HEADERS.map((h) => escape(String(row[h] ?? ""))).join(",") + "\n";
  const content = getLeadsRaw();
  fs.writeFileSync(LEADS_PATH, content + line, "utf8");
}

function updateLead(rowIndex, updates) {
  const content = getLeadsRaw();
  const rows = parseCsv(content);
  if (rows.length === 0 || rowIndex < 2) return;
  const idx = rowIndex - 2;
  if (idx < 0 || idx >= rows.length) return;
  const row = rows[idx];
  LEADS_HEADERS.forEach((h) => {
    if (updates[h] !== undefined) row[h] = String(updates[h]);
  });
  writeLeadsFull(rows);
}

function writeLeadsFull(rows) {
  ensureDir();
  let csv = LEADS_HEADERS.map((h) => escape(h)).join(",") + "\n";
  for (const r of rows) {
    csv += LEADS_HEADERS.map((h) => escape(r[h] ?? "")).join(",") + "\n";
  }
  fs.writeFileSync(LEADS_PATH, csv, "utf8");
}

const EMI_PATH = path.join(DATA_DIR, "emis.csv");

function getEmis() {
  ensureDir();
  if (!fs.existsSync(EMI_PATH)) {
    fs.writeFileSync(EMI_PATH, EMI_HEADERS.join(",") + "\n", "utf8");
  }
  const content = fs.readFileSync(EMI_PATH, "utf8");
  return parseCsv(content);
}

function getEmisByLead(leadRowId) {
  return getEmis().filter((r) => r.lead_row_id === leadRowId);
}

function appendEmi(row) {
  ensureDir();
  const content = fs.existsSync(EMI_PATH) ? fs.readFileSync(EMI_PATH, "utf8") : EMI_HEADERS.join(",") + "\n";
  const line = EMI_HEADERS.map((h) => escape(row[h] ?? "")).join(",") + "\n";
  fs.writeFileSync(EMI_PATH, content + line, "utf8");
}

const AUDIT_PATH = path.join(DATA_DIR, "audit.csv");

function getAudit() {
  ensureDir();
  if (!fs.existsSync(AUDIT_PATH)) {
    fs.writeFileSync(AUDIT_PATH, AUDIT_HEADERS.join(",") + "\n", "utf8");
  }
  const content = fs.readFileSync(AUDIT_PATH, "utf8");
  return parseCsv(content);
}

function appendAudit(row) {
  ensureDir();
  const content = fs.existsSync(AUDIT_PATH) ? fs.readFileSync(AUDIT_PATH, "utf8") : AUDIT_HEADERS.join(",") + "\n";
  const line = AUDIT_HEADERS.map((h) => escape(row[h] ?? "")).join(",") + "\n";
  fs.writeFileSync(AUDIT_PATH, content + line, "utf8");
}

module.exports = {
  getLeads,
  getLeadByRowIndex,
  appendLead,
  updateLead,
  getEmis,
  getEmisByLead,
  appendEmi,
  getAudit,
  appendAudit
};
