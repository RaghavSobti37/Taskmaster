const { PDFParse } = require('pdf-parse');
const Tesseract = require('tesseract.js');
const { getOcrMaxBytes, shouldRunImageOcr } = require('./financeOcrLimits');

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
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
  const text = String(raw).trim().replace(/\s+/g, ' ');
  if (!text) return null;

  let match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) {
    return dateFromParts(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  match = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (match) {
    return dateFromParts(Number(match[3]), Number(match[2]), Number(match[1]));
  }

  match = text.match(/^(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})$/i);
  if (match) {
    const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
    return dateFromParts(Number(match[3]), month, Number(match[1]));
  }

  return null;
}

/**
 * Extracts raw text from a PDF file buffer.
 */
async function extractTextFromPDF(buffer) {
  try {
    const parser = new PDFParse(new Uint8Array(buffer));
    const result = await parser.getText();
    return result.text || '';
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
function parseMetadataFromText(text) {
  const metadata = {
    amount: 0,
    currency: 'INR',
    vendor: '',
    date: null,
    tax: 0,
    detectedCategory: 'other'
  };

  if (!text) return metadata;

  // 1. Detect Category
  const lowerText = text.toLowerCase();
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
  if (/\$|\bUSD\b/i.test(text)) {
    metadata.currency = 'USD';
  } else if (/€|\bEUR\b/i.test(text)) {
    metadata.currency = 'EUR';
  } else if (/£|\bGBP\b/i.test(text)) {
    metadata.currency = 'GBP';
  } else if (/₹|\bINR\b/i.test(text)) {
    metadata.currency = 'INR';
  }

  // 3. Extract Amount — prefer total-line matches; handle Indian comma grouping
  metadata.amount = extractAmountFromText(text);

  // 4. Extract Tax
  const taxPatterns = [
    /(?:gst|cgst|sgst|igst|vat|tax)\s*(?:[^\w\n\r]*)\s*([\d,]+(?:\.\d{2})?)/gi
  ];
  let potentialTaxes = [];
  for (const pattern of taxPatterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
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

  // 5. Extract Date (DD/MM/YYYY preferred for Indian invoices)
  const datePatterns = [
    /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/,
    /\b(\d{1,2}[-/]\d{1,2}[-/]\d{4})\b/,
    /\b(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4})\b/i,
    /\b(?:date|dated|invoice date|bill date|dt)\s*[:\-]?\s*([\d.\-/a-zA-Z\s]{6,20})/i,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const parsedDate = parseDateValue(match[1]);
      if (parsedDate) {
        metadata.date = parsedDate;
        break;
      }
    }
  }

  // 6. Extract Vendor — header / From block only; exclude Bill To section
  metadata.vendor = extractVendorFromText(text);

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
  parseIndianNumber,
  extractAmountFromText,
  extractVendorFromText,
};
