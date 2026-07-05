const Tesseract = require('tesseract.js');
const { getOcrMaxBytes, shouldRunImageOcr } = require('./financeOcrLimits');

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const expandTwoDigitYear = (yy) => {
  const n = Number(yy);
  if (!Number.isFinite(n)) return null;
  return n >= 50 ? 1900 + n : 2000 + n;
};

const dateFromParts = (year, month, day) => {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return null;
  }
  return dt;
};

/**
 * Parse OCR date strings using DD/MM/YYYY as the default for numeric dates.
 */
function parseDateValue(raw) {
  if (!raw) return null;
  let text = String(raw).trim().replace(/\s+/g, ' ');
  if (!text) return null;

  // Normalize OCR quirks: "19/02/ 2026", "26/02, 2026", "25th Feb, 2026"
  text = text.replace(/(\d{1,2}[\/.\-]\d{1,2})[,\/\s]+(\d{2,4})\b/, '$1/$2');
  text = text.replace(/((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*),?\s+(\d{4})/i, '$1 $2');
  text = text.replace(/\s*\/\s*/g, '/');

  // Extract first date-like token from noisy OCR captures (e.g. "Date: 15/03/2024 GST")
  const tokenMatch = text.match(
    /(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4}|\d{1,2}\/(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\/\d{2,4}|\d{1,2}-(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*-\d{2,4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*,?\s*\d{4}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2}|\d{1,2}\/\d{1,2}\/\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/i,
  );
  const candidate = tokenMatch ? tokenMatch[1].replace(/,\s*/, ' ') : text;

  let match = candidate.match(/^(\d{1,2})\/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\/(\d{2,4})$/i);
  if (match) {
    const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
    const yearRaw = match[3];
    const year = yearRaw.length === 2 ? expandTwoDigitYear(yearRaw) : Number(yearRaw);
    return dateFromParts(year, month, Number(match[1]));
  }

  match = candidate.match(/^(\d{1,2})-(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*-(\d{2,4})$/i);
  if (match) {
    const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
    const yearRaw = match[3];
    const year = yearRaw.length === 2 ? expandTwoDigitYear(yearRaw) : Number(yearRaw);
    return dateFromParts(year, month, Number(match[1]));
  }

  match = candidate.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (match) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    const year = Number(match[3]);
    if (b > 12) {
      return dateFromParts(year, a, b);
    }
    return dateFromParts(year, b, a);
  }

  match = candidate.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (match) {
    const year = expandTwoDigitYear(match[3]);
    return dateFromParts(year, Number(match[2]), Number(match[1]));
  }

  match = candidate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (match) {
    const year = expandTwoDigitYear(match[3]);
    return dateFromParts(year, Number(match[1]), Number(match[2]));
  }

  match = candidate.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) {
    return dateFromParts(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  match = candidate.match(/^(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})$/i);
  if (match) {
    const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
    return dateFromParts(Number(match[3]), month, Number(match[1]));
  }

  match = candidate.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (match) {
    const month = MONTHS[match[1].slice(0, 3).toLowerCase()];
    return dateFromParts(Number(match[3]), month, Number(match[2]));
  }

  match = candidate.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*,?\s*(\d{4})$/i);
  if (match) {
    const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
    return dateFromParts(Number(match[3]), month, Number(match[1]));
  }

  return null;
}

const LABELED_DATE_PATTERNS = [
  { re: /\bpayment\s+date\b[^0-9a-z]{0,8}([\d.\-/a-zA-Z,\s]{4,28})/gi, score: 100 },
  { re: /\bissue\s+date\b[^0-9a-z]{0,8}([\d.\-/a-zA-Z,\s]{4,28})/gi, score: 91 },
  { re: /\b(?:paid|pay)\s+(?:on|date)\b[^0-9a-z]{0,8}([\d.\-/a-zA-Z,\s]{4,28})/gi, score: 95 },
  { re: /\b(?:invoice|bill|tax\s+invoice)\s+date\b[^0-9a-z]{0,8}([\d.\-/a-zA-Z,\s]{4,28})/gi, score: 92 },
  { re: /\btransaction\s+date\b[^0-9a-z]{0,8}([\d.\-/a-zA-Z,\s]{4,28})/gi, score: 88 },
  { re: /\b(?:receipt|voucher)\s+date\b[^0-9a-z]{0,8}([\d.\-/a-zA-Z,\s]{4,28})/gi, score: 86 },
  { re: /\b(?:date|dated|dt\.?)\b[^0-9a-z]{0,8}([\d.\-/a-zA-Z,\s]{4,28})/gi, score: 78 },
  { re: /\bdue\s+date\b[^0-9a-z]{0,8}([\d.\-/a-zA-Z,\s]{4,28})/gi, score: 42 },
];

const INLINE_DATE_PATTERNS = [
  /\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b/g,
  /\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\b/g,
  /\b(\d{1,2}-(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*-\d{2,4})\b/gi,
  /\b(\d{1,2}\/(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\/\d{2,4})\b/gi,
  /\b(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4})\b/gi,
  /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/gi,
  /\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2})\b/g,
  /\b(\d{1,2}\/\d{1,2}\/\d{2})\b/g,
];

const NEXT_LINE_DATE_LABEL = /^(?:dated|date|invoice\s+date|bill\s+date)\s*:?\s*$/i;
const BOOKING_DATE_LINE = /\bbooking\s+date\b/i;

function extractPaymentDateFromFilename(rawName, fallbackYear = new Date().getUTCFullYear()) {
  const name = String(rawName || '').trim();
  if (!name) return null;

  const tryYmd = (year, month, day) => dateFromParts(year, month, day) || null;

  let match = name.match(/\b(\d{1,2})[-.](\d{1,2})[-.](\d{4})\b/);
  if (match) {
    const dt = tryYmd(Number(match[3]), Number(match[2]), Number(match[1]));
    if (dt) return dt;
  }

  match = name.match(/\b(\d{4})[\s._-](\d{1,2})[\s._-](\d{1,2})\b/);
  if (match) {
    const dt = tryYmd(Number(match[1]), Number(match[2]), Number(match[3]));
    if (dt) return dt;
  }

  match = name.match(/\b(\d{1,2})(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(\d{4})\b/i);
  if (match) {
    const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
    const dt = tryYmd(Number(match[3]), month, Number(match[1]));
    if (dt) return dt;
  }

  match = name.match(/\breceipt[\s._-]*(\d{1,2})(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(\d{4})\b/i);
  if (match) {
    const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
    const dt = tryYmd(Number(match[3]), month, Number(match[1]));
    if (dt) return dt;
  }

  match = name.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i);
  if (match) {
    const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
    const year = Number(fallbackYear) || new Date().getUTCFullYear();
    const dt = tryYmd(year, month, Number(match[1]));
    if (dt) return dt;
  }

  match = name.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i);
  if (match) {
    const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
    const year = Number(fallbackYear) || new Date().getUTCFullYear();
    const dt = tryYmd(year, month, Number(match[1]));
    if (dt) return dt;
  }

  match = name.match(/\b(\d{2})\s+(\d{2})\s+(\d{4})\b/);
  if (match) {
    const dt = tryYmd(Number(match[3]), Number(match[2]), Number(match[1]));
    if (dt) return dt;
  }

  match = name.match(/_(\d{2})(\d{2})(\d{2})_\d{4,6}/i);
  if (match) {
    const dt = tryYmd(2000 + Number(match[1]), Number(match[2]), Number(match[3]));
    if (dt) return dt;
  }

  match = name.match(/_(\d{2})(\d{2})(\d{2})(?:_|\.pdf|$)/i);
  if (match) {
    const dt = tryYmd(2000 + Number(match[1]), Number(match[2]), Number(match[3]));
    if (dt) return dt;
  }

  match = name.match(/\b(\d{4})-(\d{2})-(\d{4})\b/);
  if (match) {
    const tail = match[3];
    if (tail.length === 4 && tail.startsWith('0')) {
      const month = Number(tail.slice(0, 2));
      const day = Number(tail.slice(2, 4));
      const year = Number(match[2]) < 80 ? 2000 + Number(match[2]) : Number(match[1]);
      const dt = tryYmd(year, month, day);
      if (dt) return dt;
    }
  }

  return null;
}

function isPlausiblePaymentYear(year) {
  const y = Number(year);
  return Number.isFinite(y) && y >= 2005 && y <= new Date().getFullYear() + 1;
}

function scoreInlineDateContext(line, index) {
  const lower = line.toLowerCase();
  let score = 30;
  if (/(?:invoice|bill|receipt|payment|transaction|dated|date)/i.test(lower)) score += 25;
  if (/(?:start\s+date|departure|arrival)/i.test(lower)) score -= 45;
  if (/\bbooking\s+date\b/i.test(lower)) score += 35;
  if (/(?:gstin|pan|phone|mobile|account|ifsc|invoice\s*no|bill\s*no|#)/i.test(lower)) score -= 35;
  if (index < 25) score += 10;
  return score;
}

/**
 * Score labeled + inline dates; prefer payment/invoice date lines over random numbers.
 */
function extractPaymentDateFromText(text) {
  if (!text) return null;

  const candidates = [];
  const lines = text.split('\n');

  for (const line of lines) {
    for (const { re, score } of LABELED_DATE_PATTERNS) {
      re.lastIndex = 0;
      let match;
      while ((match = re.exec(line)) !== null) {
        const parsed = parseDateValue(match[1]);
        if (parsed && isPlausiblePaymentYear(parsed.getUTCFullYear())) {
          candidates.push({ date: parsed, score });
        }
      }
    }
  }

  for (let i = 0; i < lines.length - 1; i += 1) {
    const line = lines[i].trim();
    if (!NEXT_LINE_DATE_LABEL.test(line) && !BOOKING_DATE_LINE.test(line)) continue;
    const next = lines[i + 1].trim();
    const parsed = parseDateValue(next);
    if (parsed && isPlausiblePaymentYear(parsed.getUTCFullYear())) {
      candidates.push({ date: parsed, score: BOOKING_DATE_LINE.test(line) ? 94 : 96 });
    }
  }

  const FORWARD_DATE_LABEL = /\b(?:invoice|bill|tax\s+invoice)\s+date\b\s*:?\s*$/i;
  for (let i = 0; i < lines.length; i += 1) {
    if (!FORWARD_DATE_LABEL.test(lines[i].trim())) continue;
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j += 1) {
      const parsed = parseDateValue(lines[j]);
      if (parsed && isPlausiblePaymentYear(parsed.getUTCFullYear())) {
        candidates.push({ date: parsed, score: 93 });
        break;
      }
    }
  }

  // IRCTC / travel tickets: "Booking Date ... DD-Mon-YYYY"
  const bookingMatch = text.match(/\bbooking\s+date\b[^0-9a-z]{0,12}(\d{1,2}-(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*-\d{4})/i);
  if (bookingMatch) {
    const parsed = parseDateValue(bookingMatch[1]);
    if (parsed && isPlausiblePaymentYear(parsed.getUTCFullYear())) {
      candidates.push({ date: parsed, score: 90 });
    }
  }

  lines.forEach((line, index) => {
    for (const pattern of INLINE_DATE_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const parsed = parseDateValue(match[1]);
        if (parsed && isPlausiblePaymentYear(parsed.getUTCFullYear())) {
          candidates.push({ date: parsed, score: scoreInlineDateContext(line, index) });
        }
      }
    }
  });

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].date;
}

/**
 * Extracts raw text from a PDF file buffer.
 */
// ponytail: lazy require — pdf-parse v2 pulls pdfjs + canvas and crashes Render boot
let pdfParseModule;
function getPdfParseModule() {
  if (!pdfParseModule) {
    pdfParseModule = require('pdf-parse');
  }
  return pdfParseModule;
}

async function extractTextFromPDF(buffer) {
  try {
    const { PDFParse } = getPdfParseModule();
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result?.text || '';
  } catch (error) {
    console.error('PDFParse error:', error);
    return '';
  }
}

/**
 * Extracts raw text from an image file buffer using Tesseract.js.
 */
async function extractTextFromImage(buffer) {
  try {
    const { data: { text } } = await Tesseract.recognize(
      buffer,
      'eng',
      { logger: m => {} } // Disable verbose logs
    );
    return text || '';
  } catch (error) {
    console.error('tesseract.js error:', error);
    return '';
  }
}

/**
 * Parse amount strings with Indian (3,12,000) or Western (12,000.00) grouping.
 */
function parseIndianNumber(raw) {
  if (raw === undefined || raw === null) return NaN;
  const cleaned = String(raw).trim().replace(/[₹$€£\s]/gi, '');
  if (!cleaned) return NaN;

  const [intPart, fracPart] = cleaned.split('.');
  const digitsOnly = intPart.replace(/,/g, '');
  if (!/^\d+$/.test(digitsOnly)) return NaN;

  const value = Number(`${digitsOnly}${fracPart !== undefined ? `.${fracPart}` : ''}`);
  return Number.isFinite(value) ? value : NaN;
}

function scoreAmountLine(line) {
  const lower = line.toLowerCase();
  if (/(?:grand\s+)?total|net\s+payable|amount\s+due|total\s+amount|balance\s+due|total\s+paid/i.test(lower)) {
    return 100;
  }
  if (/sub\s*total|subtotal/i.test(lower)) return 25;
  if (/(?:^|\s)(?:total|amount)(?:\s|$)/i.test(lower)) return 60;
  return 10;
}

function extractAmountFromText(text) {
  const lines = text.split('\n');
  const scored = [];

  for (const line of lines) {
    const lineScore = scoreAmountLine(line);
    const amountRegex = /(?:₹|rs\.?|inr|\$)?\s*([\d,]+(?:\.\d{1,2})?)/gi;
    let match;
    while ((match = amountRegex.exec(line)) !== null) {
      const val = parseIndianNumber(match[1]);
      if (!Number.isFinite(val) || val <= 0 || val >= 100000000) continue;

      let score = lineScore;
      const digitsInLine = line.replace(/[^\d]/g, '');
      if (digitsInLine.length >= 10 && !/(?:total|amount|payable|due|paid)/i.test(line)) {
        score -= 40;
      }
      if (/(?:phone|mobile|tel|gstin|pan|account|ifsc|invoice\s*no|bill\s*no)/i.test(line)) {
        score -= 30;
      }
      scored.push({ val, score });
    }
  }

  if (!scored.length) return 0;
  scored.sort((a, b) => b.score - a.score || b.val - a.val);
  return scored[0].val;
}

function extractVendorFromText(text) {
  if (!text) return '';

  const lowerText = text.toLowerCase();
  const billToMatch = lowerText.match(/\b(?:bill\s*to|billed\s*to|ship\s*to|consignee)\b/i);
  const headerText = billToMatch
    ? text.slice(0, billToMatch.index)
    : text;

  const fromMatch = headerText.match(
    /\b(?:from|seller|vendor|supplier|issued\s+by|service\s+provider)\s*[:\-]?\s*([^\n]+)/i,
  );
  if (fromMatch?.[1]) {
    const candidate = fromMatch[1].trim();
    if (candidate.length > 3 && !/invoice|tax|receipt/i.test(candidate)) {
      return candidate.substring(0, 100);
    }
  }

  const lines = headerText
    .split('\n')
    .map((l) => l.trim())
    .filter(
      (l) => l.length > 3
        && !/invoice|tax|bill|receipt|page|date|tel|phone|email|website|address|total|payment|balance|gstin|pan|cin|amount|rupees/i.test(l),
    );

  if (lines.length > 0) {
    return lines[0].substring(0, 100);
  }

  return '';
}

/**
 * Regular expression parsing to extract receipt/invoice metadata from text.
 */
function parseMetadataFromText(text, context = {}) {
  const metadata = {
    amount: 0,
    currency: 'INR',
    vendor: '',
    date: null,
    tax: 0,
    detectedCategory: 'other'
  };

  const body = String(text || '').trim();
  if (!body) {
    const fallbackYear = context.createdAt
      ? new Date(context.createdAt).getUTCFullYear()
      : new Date().getUTCFullYear();
    metadata.date = extractPaymentDateFromFilename(
      [context.title, context.fileName].filter(Boolean).join(' '),
      fallbackYear,
    );
    return metadata;
  }

  // 1. Detect Category
  const lowerText = body.toLowerCase();
  if (lowerText.includes('invoice') || lowerText.includes('bill no') || lowerText.includes('tax invoice')) {
    metadata.detectedCategory = 'invoice';
  } else if (lowerText.includes('receipt') || lowerText.includes('payment success') || lowerText.includes('ticket') || lowerText.includes('boarding pass')) {
    metadata.detectedCategory = 'receipt';
  } else if (lowerText.includes('contract') || lowerText.includes('agreement') || lowerText.includes('lease')) {
    metadata.detectedCategory = 'contract';
  } else if (lowerText.includes('proposal') || lowerText.includes('estimate') || lowerText.includes('quotation')) {
    metadata.detectedCategory = 'proposal';
  } else if (lowerText.includes('budget') || lowerText.includes('cost estimation')) {
    metadata.detectedCategory = 'budget';
  } else if (lowerText.includes('tax return') || lowerText.includes('income tax') || lowerText.includes('itr')) {
    metadata.detectedCategory = 'tax';
  } else if (lowerText.includes('report') || lowerText.includes('financial report') || lowerText.includes('statement')) {
    metadata.detectedCategory = 'report';
  }

  // 2. Extract Currency — word/symbol boundaries only (avoid "entrepreneur" → EUR)
  if (/\$|\bUSD\b/i.test(body)) {
    metadata.currency = 'USD';
  } else if (/€|\bEUR\b/i.test(body)) {
    metadata.currency = 'EUR';
  } else if (/£|\bGBP\b/i.test(body)) {
    metadata.currency = 'GBP';
  } else if (/₹|\bINR\b/i.test(body)) {
    metadata.currency = 'INR';
  }

  // 3. Extract Amount — prefer total-line matches; handle Indian comma grouping
  metadata.amount = extractAmountFromText(body);

  // 4. Extract Tax
  const taxPatterns = [
    /(?:gst|cgst|sgst|igst|vat|tax)\s*(?:[^\w\n\r]*)\s*([\d,]+(?:\.\d{2})?)/gi
  ];
  let potentialTaxes = [];
  for (const pattern of taxPatterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(body)) !== null) {
      if (match[1]) {
        const taxVal = parseIndianNumber(match[1]);
        if (!isNaN(taxVal) && taxVal > 0) {
          potentialTaxes.push(taxVal);
        }
      }
    }
  }
  if (potentialTaxes.length > 0) {
    // If tax is extracted and it's less than the total amount, set it
    const maxTax = Math.max(...potentialTaxes);
    if (maxTax < metadata.amount) {
      metadata.tax = maxTax;
    }
  }

  // 5. Extract payment / invoice date (labeled lines beat random inline dates)
  metadata.date = extractPaymentDateFromText(body);
  if (!metadata.date) {
    const fallbackYear = context.createdAt
      ? new Date(context.createdAt).getUTCFullYear()
      : new Date().getUTCFullYear();
    metadata.date = extractPaymentDateFromFilename(
      [context.title, context.fileName].filter(Boolean).join(' '),
      fallbackYear,
    );
  }

  // 6. Extract Vendor — header / From block only; exclude Bill To section
  metadata.vendor = extractVendorFromText(body);

  // Known vendor normalizations (only when not clearly Bill To)
  const billToIdx = lowerText.search(/\b(?:bill\s*to|billed\s*to)\b/i);
  const billToSection = billToIdx >= 0 ? lowerText.slice(billToIdx) : '';
  const shaktiInBillTo = billToSection && /shakti collective/i.test(billToSection);

  if (lowerText.includes('karma travels')) {
    metadata.vendor = 'Karma Travels';
  } else if (
    !shaktiInBillTo
    && (lowerText.includes('shakti collective llp') || lowerText.includes('shakti collective llc'))
    && !metadata.vendor
  ) {
    metadata.vendor = 'Shakti Collective';
  } else if (lowerText.includes('sage university')) {
    metadata.vendor = 'Sage University';
  } else if (lowerText.includes('dwelling inn')) {
    metadata.vendor = 'Hotel Dwelling Inn';
  } else if (lowerText.includes('prasad khaparde')) {
    metadata.vendor = 'Prasad Khaparde';
  } else if (lowerText.includes('avinash sarmah')) {
    metadata.vendor = 'Avinash Sarmah';
  } else if (lowerText.includes('deepak rawat')) {
    metadata.vendor = 'Deepak Rawat';
  } else if (lowerText.includes('siddharth shyam')) {
    metadata.vendor = 'Siddharth Shyam';
  }

  return metadata;
}

const EMPTY_METADATA = {
  amount: 0,
  currency: 'INR',
  vendor: '',
  date: null,
  tax: 0,
  detectedCategory: 'other',
};

/**
 * Main parse function. Detects type and extracts data.
 */
async function parseDocument(fileBuffer, mimeType, options = {}) {
  const maxBytes = getOcrMaxBytes();
  const size = options.fileSize ?? fileBuffer?.length ?? 0;
  if (size > maxBytes) {
    return { extractedText: '', metadata: { ...EMPTY_METADATA } };
  }

  let extractedText = '';
  const normalizedMime = String(mimeType || '').toLowerCase();

  if (normalizedMime.includes('pdf') || /\.pdf$/i.test(normalizedMime)) {
    extractedText = await extractTextFromPDF(fileBuffer);
  } else if (normalizedMime.includes('image') || /\.(png|jpe?g|webp)$/i.test(normalizedMime)) {
    if (!shouldRunImageOcr()) {
      return { extractedText: '', metadata: { ...EMPTY_METADATA } };
    }
    extractedText = await extractTextFromImage(fileBuffer);
  }

  const metadata = parseMetadataFromText(extractedText);

  return {
    extractedText,
    metadata,
  };
}

module.exports = {
  parseDocument,
  parseMetadataFromText,
  parseDateValue,
  extractPaymentDateFromText,
  extractPaymentDateFromFilename,
  parseIndianNumber,
  extractAmountFromText,
  extractVendorFromText,
};
