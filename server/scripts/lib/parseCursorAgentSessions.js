/**
 * Parse Cursor agent transcript JSONL files into coding sessions with real timestamps.
 * Used to attribute Git commit duration from session boundaries — no guessed times.
 */
const fs = require('fs');
const path = require('path');

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** @param {string} text e.g. "Friday, Jul 3, 2026, 3:11 PM (UTC+5:30)" */
function parseCursorTimestamp(text) {
  const m = String(text).match(
    /(\w+)\s+(\d{1,2}),\s+(\d{4}),\s+(\d{1,2}):(\d{2})\s+(AM|PM)\s+\(UTC([+-]\d{1,2})(?::(\d{2}))?\)/i,
  );
  if (!m) return null;

  const mon = MONTHS[m[1].slice(0, 3).toLowerCase()];
  if (mon === undefined) return null;

  let hour = parseInt(m[4], 10);
  const minute = parseInt(m[5], 10);
  const ampm = m[6].toUpperCase();
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;

  const offH = parseInt(m[7], 10);
  const offM = parseInt(m[8] || '0', 10);
  const sign = offH >= 0 ? '+' : '-';
  const absH = Math.abs(offH);
  const tz = `${sign}${String(absH).padStart(2, '0')}:${String(offM).padStart(2, '0')}`;
  const iso = `${m[3]}-${String(mon + 1).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${tz}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function extractTimestampsFromText(text) {
  const out = [];
  const re = /<timestamp>([^<]+)<\/timestamp>/gi;
  let match;
  while ((match = re.exec(text)) !== null) {
    const d = parseCursorTimestamp(match[1]);
    if (d) out.push(d);
  }
  return out;
}

function collectLineText(lineObj) {
  const chunks = [];
  const content = lineObj?.message?.content;
  if (!Array.isArray(content)) return chunks;
  for (const part of content) {
    if (part?.type === 'text' && part.text) chunks.push(String(part.text));
    if (part?.type === 'tool_use' && part.input) {
      if (part.name === 'Shell' && part.input.command) {
        chunks.push(String(part.input.command));
      }
      try {
        chunks.push(JSON.stringify(part.input));
      } catch {
        chunks.push(String(part.input));
      }
    }
  }
  return chunks.join('\n');
}

function extractGitShellBlocks(text) {
  const blocks = [];
  const shellRe = /git\s+[\s\S]{0,4000}/gi;
  let match;
  while ((match = shellRe.exec(text)) !== null) {
    blocks.push(match[0]);
  }
  return blocks;
}

function extractCommitHints(text) {
  const shas = new Set();
  const messages = new Set();
  const gitBlocks = extractGitShellBlocks(text);
  const scanText = gitBlocks.length ? gitBlocks.join('\n') : text;

  const commitMsgPatterns = [
    /git commit[\s\S]*?-m\s+["']([^"']+)["']/gi,
    /git commit[\s\S]*?-m\s+"((?:\\.|[^"\\])*)"/gi,
    /git commit[\s\S]*?-m\s+'((?:\\.|[^'\\])*)'/gi,
  ];
  for (const re of commitMsgPatterns) {
    let m;
    while ((m = re.exec(scanText)) !== null) {
      const msg = m[1].replace(/\\"/g, '"').replace(/\\'/g, "'").trim();
      if (msg.length >= 4 && !msg.startsWith('$(cat')) messages.add(msg);
    }
  }

  const commitCmdRe = /git\s+commit[\s\S]{0,2000}/gi;
  let cmdMatch;
  while ((cmdMatch = commitCmdRe.exec(scanText)) !== null) {
    const block = cmdMatch[0];
    const shaRe = /\b[0-9a-f]{7,40}\b/gi;
    let shaMatch;
    while ((shaMatch = shaRe.exec(block)) !== null) {
      shas.add(shaMatch[0].toLowerCase());
    }
  }

  return { shas, messages };
}

/**
 * @param {string} filePath absolute path to .jsonl transcript
 * @returns {import('./parseCursorAgentSessions.types').AgentSession | null}
 */
function parseTranscriptFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const timestamps = [];
  const shas = new Set();
  const messages = new Set();

  for (const line of lines) {
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const text = collectLineText(obj);
    for (const ts of extractTimestampsFromText(text)) timestamps.push(ts);
    const hints = extractCommitHints(text);
    hints.shas.forEach((s) => shas.add(s));
    hints.messages.forEach((m) => messages.add(m));
  }

  if (timestamps.length === 0 && shas.size === 0 && messages.size === 0) return null;

  timestamps.sort((a, b) => a - b);
  const sessionId = path.basename(filePath, '.jsonl');

  return {
    id: sessionId,
    filePath,
    startAt: timestamps.length ? timestamps[0] : null,
    endAt: timestamps.length ? timestamps[timestamps.length - 1] : null,
    commitShas: [...shas],
    commitMessages: [...messages],
    timestampCount: timestamps.length,
    hasTimestamps: timestamps.length > 0,
  };
}

/**
 * @param {string} transcriptsRoot folder containing session subdirs or flat jsonl files
 * @param {{ includeSubagents?: boolean }} [opts]
 */
function loadAgentSessions(transcriptsRoot, opts = {}) {
  const includeSubagents = opts.includeSubagents === true;
  const sessions = [];

  if (!fs.existsSync(transcriptsRoot)) {
    return sessions;
  }

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!includeSubagents && entry.name === 'subagents') continue;
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.jsonl')) continue;
      const session = parseTranscriptFile(full);
      if (session) sessions.push(session);
    }
  };

  walk(transcriptsRoot);
  sessions.sort((a, b) => a.startAt - b.startAt);
  return sessions;
}

/**
 * Match a git commit to at most one session using transcript evidence only.
 * @param {{ sha: string, shortSha: string, subject: string }} commit
 * @param {ReturnType<typeof loadAgentSessions>} sessions
 */
function findSessionForCommit(commit, sessions) {
  const sha = commit.sha.toLowerCase();
  const short = commit.shortSha.toLowerCase();
  const subject = commit.subject.trim();

  for (const session of sessions) {
    const shaHit = session.commitShas.some((s) => {
      const lower = s.toLowerCase();
      return lower === sha || lower === short || sha.startsWith(lower) || lower.startsWith(short);
    });
    if (shaHit) return { session, matchType: 'sha' };

    const msgHit = session.commitMessages.some((m) => {
      const norm = m.trim();
      return norm === subject || subject.startsWith(norm) || norm.startsWith(subject);
    });
    if (msgHit) return { session, matchType: 'message' };
  }

  return null;
}

/**
 * Allocate wall-clock interval for a commit inside a session (real boundaries only).
 * @param {Date} commitAt git author date
 * @param {Date|null} previousCommitAt prior matched commit in same session
 * @param {{ startAt: Date, endAt: Date }} session
 */
function allocateCommitInterval(commitAt, previousCommitAt, session) {
  let start = previousCommitAt || session.startAt || null;
  if (!start) return null;
  const end = commitAt;
  const durationMs = end - start;
  if (durationMs < 60_000) return null;
  return { startAt: start, endAt: end, durationMs };
}

function dateToClockIST(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

module.exports = {
  parseCursorTimestamp,
  extractTimestampsFromText,
  parseTranscriptFile,
  loadAgentSessions,
  findSessionForCommit,
  allocateCommitInterval,
  dateToClockIST,
  MONTHS,
};
