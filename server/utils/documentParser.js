const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const Tesseract = require('tesseract.js');
const { parse } = require('path');

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

  // 2. Extract Currency
  if (lowerText.includes('$') || lowerText.includes('usd')) {
    metadata.currency = 'USD';
  } else if (lowerText.includes('€') || lowerText.includes('eur')) {
    metadata.currency = 'EUR';
  } else if (lowerText.includes('£') || lowerText.includes('gbp')) {
    metadata.currency = 'GBP';
  }

  // 3. Extract Amount
  // Look for total/grand total/amount patterns. We'll search for matches, clean commas, and choose a reasonable total.
  // We want to avoid matching phone numbers or invoice numbers, so we target lines containing amount indicators.
  const amountPatterns = [
    /(?:total|due|payable|amount|net|grand total|total amount|inr|rs\.?|\$)\s*(?:[^\w\n\r]*)\s*([\d,]+(?:\.\d{2})?)/gi,
    /(?:net payable|total payable|total paid|paid amount|amount paid)\s*(?:[^\w\n\r]*)\s*([\d,]+(?:\.\d{2})?)/gi
  ];

  let potentialAmounts = [];
  for (const pattern of amountPatterns) {
    let match;
    // Reset regex state
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) {
        // Strip commas and parse
        const amtStr = match[1].replace(/,/g, '');
        const val = parseFloat(amtStr);
        if (!isNaN(val) && val > 0 && val < 100000000) { // Limit to reasonable invoice amounts
          potentialAmounts.push(val);
        }
      }
    }
  }

  // If we found amounts, try to grab the largest one (usually the grand total), or the last one in the document
  if (potentialAmounts.length > 0) {
    metadata.amount = Math.max(...potentialAmounts);
  }

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
        const taxVal = parseFloat(match[1].replace(/,/g, ''));
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

  // 6. Extract Vendor Name
  // Heuristic: First few lines of the text usually contain the vendor name.
  // We can look at the first non-empty lines, excluding things like "INVOICE", "TAX INVOICE", date etc.
  const lines = text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 3 && !/invoice|tax|bill|receipt|page|date|tel|phone|email|website|address|total|payment|balance/i.test(l));

  if (lines.length > 0) {
    // Take the first line as potential vendor
    metadata.vendor = lines[0].substring(0, 100);
  }

  // Special vendor checks (common vendors in workspace)
  if (lowerText.includes('karma travels')) {
    metadata.vendor = 'Karma Travels';
  } else if (lowerText.includes('shakti collective llp') || lowerText.includes('shakti collective llc')) {
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

function getParseMaxBytes() {
  const configured = Number(process.env.FINANCE_OCR_MAX_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : 8 * 1024 * 1024;
}

function shouldSkipImageOcr() {
  return process.env.FINANCE_SKIP_IMAGE_OCR === '1' || process.env.RENDER === 'true';
}

/**
 * Main parse function. Detects type and extracts data.
 */
async function parseDocument(fileBuffer, mimeType, options = {}) {
  const maxBytes = getParseMaxBytes();
  const size = options.fileSize ?? fileBuffer?.length ?? 0;
  if (size > maxBytes) {
    return { extractedText: '', metadata: { ...EMPTY_METADATA } };
  }

  let extractedText = '';
  const normalizedMime = String(mimeType || '').toLowerCase();

  if (normalizedMime.includes('pdf') || /\.pdf$/i.test(normalizedMime)) {
    extractedText = await extractTextFromPDF(fileBuffer);
  } else if (normalizedMime.includes('image') || /\.(png|jpe?g|webp)$/i.test(normalizedMime)) {
    if (shouldSkipImageOcr()) {
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
  extractTextFromPDF,
  extractTextFromImage,
  parseDateValue,
  parseMetadataFromText,
  parseDocument
};
