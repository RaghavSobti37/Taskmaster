const { parseDocument } = require('../utils/documentParser');
const {
  shouldRunOcr,
  shouldRunImageOcr,
  getOcrMaxBytes,
} = require('../utils/financeOcr');

describe('documentParser memory guards', () => {
  const prevRender = process.env.RENDER;
  const prevSkip = process.env.FINANCE_SKIP_IMAGE_OCR;

  afterEach(() => {
    if (prevRender === undefined) delete process.env.RENDER;
    else process.env.RENDER = prevRender;
    if (prevSkip === undefined) delete process.env.FINANCE_SKIP_IMAGE_OCR;
    else process.env.FINANCE_SKIP_IMAGE_OCR = prevSkip;
  });

  it('skips image OCR on Render to avoid tesseract OOM', async () => {
    process.env.RENDER = 'true';
    expect(shouldRunImageOcr()).toBe(false);

    const result = await parseDocument(Buffer.from('fake'), 'image/png', { fileSize: 100 });
    expect(result.extractedText).toBe('');
    expect(result.metadata.detectedCategory).toBe('other');
  });

  it('skips parse when file exceeds max bytes', async () => {
    const max = getOcrMaxBytes();
    const result = await parseDocument(Buffer.alloc(16), 'application/pdf', { fileSize: max + 1 });
    expect(result.extractedText).toBe('');
  });

  it('shouldRunOcr respects fileSize cap', () => {
    const max = getOcrMaxBytes();
    expect(shouldRunOcr(max)).toBe(true);
    expect(shouldRunOcr(max + 1)).toBe(false);
  });
});

describe('documentParser metadata extraction', () => {
  const {
    parseMetadataFromText,
    parseIndianNumber,
    extractAmountFromText,
    extractVendorFromText,
  } = require('../utils/documentParser');

  it('parseIndianNumber handles lakh-style grouping', () => {
    expect(parseIndianNumber('3,12,000')).toBe(312000);
    expect(parseIndianNumber('12,000')).toBe(12000);
    expect(parseIndianNumber('1,23,456.78')).toBe(123456.78);
  });

  it('prefers total line amount over unrelated numbers', () => {
    const text = `
      Mukund Jethwa
      INVOICE
      Bill To: Shakti Collective LLP
      Phone: 9876543210
      Line items
      Sub Total: 10,000
      GST: 2,000
      Grand Total: 12,000
    `;
    expect(extractAmountFromText(text)).toBe(12000);
  });

  it('extracts vendor from header, not Bill To', () => {
    const text = `
      Mukund Jethwa
      Freelance Consultant
      TAX INVOICE
      Bill To: Shakti Collective LLP
      Grand Total: 12,000
    `;
    const vendor = extractVendorFromText(text);
    expect(vendor.toLowerCase()).toContain('mukund');
    expect(vendor.toLowerCase()).not.toContain('shakti');
  });

  it('parseMetadataFromText end-to-end for Indian invoice', () => {
    const meta = parseMetadataFromText(`
      Mukund Jethwa
      TAX INVOICE
      Bill To: Shakti Collective LLP
      Grand Total Rs. 12,000
      Date: 15/03/2024
    `);
    expect(meta.amount).toBe(12000);
    expect(meta.vendor.toLowerCase()).toContain('mukund');
    expect(meta.detectedCategory).toBe('invoice');
    expect(meta.date?.toISOString().slice(0, 10)).toBe('2024-03-15');
  });

  it('prefers payment date over due date', () => {
    const { extractPaymentDateFromText } = require('../utils/documentParser');
    const text = `
      TAX INVOICE
      Due Date: 30/04/2024
      Payment Date: 15/03/2024
    `;
    expect(extractPaymentDateFromText(text)?.toISOString().slice(0, 10)).toBe('2024-03-15');
  });

  it('parses dotted and month-name dates', () => {
    const { parseDateValue, extractPaymentDateFromText } = require('../utils/documentParser');
    expect(parseDateValue('15.03.2024')?.toISOString().slice(0, 10)).toBe('2024-03-15');
    expect(extractPaymentDateFromText('Invoice Date  March 15, 2024')?.toISOString().slice(0, 10)).toBe('2024-03-15');
  });

  it('parses YYMMDD chunks embedded in invoice filenames', () => {
    const { extractPaymentDateFromFilename } = require('../utils/documentParser');
    expect(
      extractPaymentDateFromFilename('Bill No507 Shakti Collective LLP_260302_093200 (1)')?.toISOString().slice(0, 10),
    ).toBe('2026-03-02');
    expect(
      extractPaymentDateFromFilename('P3P-2025-26-0111, Shakti Collective LLP')?.toISOString().slice(0, 10),
    ).toBe('2026-01-11');
  });

  it('extracts payment date from WhatsApp image filename', () => {
    const { extractPaymentDateFromFilename } = require('../utils/documentParser');
    expect(
      extractPaymentDateFromFilename('WhatsApp Image 2026 04 07 at 2.05.18 PM')?.toISOString().slice(0, 10),
    ).toBe('2026-04-07');
  });

  it('extracts month-day from filename with upload year fallback', () => {
    const { extractPaymentDateFromFilename } = require('../utils/documentParser');
    expect(
      extractPaymentDateFromFilename('779989458 13 may mum to nasik', 2025)?.toISOString().slice(0, 10),
    ).toBe('2025-05-13');
  });

  it('parses DD-Mon-YY and DD-MM-YY Indian invoice formats', () => {
    const { parseDateValue, extractPaymentDateFromText } = require('../utils/documentParser');
    expect(parseDateValue('19-Feb-26')?.toISOString().slice(0, 10)).toBe('2026-02-19');
    expect(parseDateValue('26-Dec-25')?.toISOString().slice(0, 10)).toBe('2025-12-26');
    expect(parseDateValue('19-03-26')?.toISOString().slice(0, 10)).toBe('2026-03-19');
    expect(parseDateValue('01-Apr-2025')?.toISOString().slice(0, 10)).toBe('2025-04-01');

    const tallyInvoice = `
      Reference No. & Date.
      Dated
      19-Feb-26
      Delivery Note Date
    `;
    expect(extractPaymentDateFromText(tallyInvoice)?.toISOString().slice(0, 10)).toBe('2026-02-19');

    expect(extractPaymentDateFromText('Date 19-03-26')?.toISOString().slice(0, 10)).toBe('2026-03-19');
  });

  it('parses IRCTC booking date and Uber M/D/YY receipts', () => {
    const { extractPaymentDateFromText } = require('../utils/documentParser');
    const irctc = `
      Quota Distance Booking Date
      GENERAL (GN) 1537 KM 29-Mar-2025 22:06:24 HRS
    `;
    expect(extractPaymentDateFromText(irctc)?.toISOString().slice(0, 10)).toBe('2025-03-29');
    expect(extractPaymentDateFromText('(2 4/5/26 2:17 am')?.toISOString().slice(0, 10)).toBe('2026-05-04');
  });

  it('ignores phone-like numeric lines when picking inline dates', () => {
    const { extractPaymentDateFromText } = require('../utils/documentParser');
    const text = `
      Mobile: 9876543210
      Invoice Date: 02/01/2024
    `;
    expect(extractPaymentDateFromText(text)?.toISOString().slice(0, 10)).toBe('2024-01-02');
  });

  it('does not treat entrepreneur substring as EUR', () => {
    const meta = parseMetadataFromText('blog topics for online music entrepreneur academy 2026');
    expect(meta.currency).toBe('INR');
  });

  it('parses Uber weekday receipts and invoice month labels', () => {
    const { extractPaymentDateFromText, parseDateValue } = require('../utils/documentParser');
    expect(
      extractPaymentDateFromText('Thursday, March 13, 2025')?.toISOString().slice(0, 10),
    ).toBe('2025-03-13');
    expect(parseDateValue('March 2026')?.toISOString().slice(0, 10)).toBe('2026-03-01');
    expect(
      extractPaymentDateFromText('Invoice Month: March 2026')?.toISOString().slice(0, 10),
    ).toBe('2026-03-01');
  });

  it('falls back to createdAt only for spreadsheet imports with zero text', () => {
    const meta = parseMetadataFromText('', {
      title: 'spreadsheet-import.xlsx',
      fileName: 'spreadsheet-import.xlsx',
      createdAt: new Date('2025-11-20T12:00:00Z'),
    });
    expect(meta.date?.toISOString().slice(0, 10)).toBe('2025-11-20');

    const docx = parseMetadataFromText('', {
      fileName: 'vendor-invoice.docx',
      createdAt: new Date('2025-11-20T12:00:00Z'),
    });
    expect(docx.date?.toISOString().slice(0, 10)).toBe('2025-11-20');

    const invoice = parseMetadataFromText('Grand Total: 5,000', {
      title: 'vendor-invoice.pdf',
      createdAt: new Date('2025-11-20T12:00:00Z'),
    });
    expect(invoice.date).toBeNull();
  });
});

describe('documentParser PDF OCR guards', () => {
  const {
    shouldRunPdfOcr,
    MIN_PDF_TEXT_CHARS,
  } = require('../utils/financeOcrLimits');
  const { shouldUsePdfScreenshotOcr } = require('../utils/documentParser');

  const prevRender = process.env.RENDER;
  const prevPdfOcr = process.env.FINANCE_PDF_OCR;

  afterEach(() => {
    if (prevRender === undefined) delete process.env.RENDER;
    else process.env.RENDER = prevRender;
    if (prevPdfOcr === undefined) delete process.env.FINANCE_PDF_OCR;
    else process.env.FINANCE_PDF_OCR = prevPdfOcr;
  });

  it('skips PDF screenshot OCR on Render unless forced', () => {
    process.env.RENDER = 'true';
    delete process.env.FINANCE_PDF_OCR;
    expect(shouldRunPdfOcr()).toBe(false);
    expect(shouldUsePdfScreenshotOcr('')).toBe(false);
    process.env.FINANCE_PDF_OCR = '1';
    expect(shouldRunPdfOcr()).toBe(true);
    expect(shouldUsePdfScreenshotOcr('', { forcePdfOcr: true })).toBe(true);
  });

  it('triggers PDF OCR when text layer is thin', () => {
    delete process.env.RENDER;
    expect(MIN_PDF_TEXT_CHARS).toBe(20);
    expect(shouldUsePdfScreenshotOcr('short')).toBe(true);
    expect(shouldUsePdfScreenshotOcr('x'.repeat(25))).toBe(false);
  });
});

describe('documentParser PDF info dates', () => {
  const { pickDateFromPdfInfoNode } = require('../utils/documentParser');

  it('prefers ModDate over CreationDate when both plausible', () => {
    const mod = new Date('2025-06-15T12:00:00Z');
    const created = new Date('2024-01-10T12:00:00Z');
    expect(pickDateFromPdfInfoNode({ ModDate: mod, CreationDate: created })).toEqual(mod);
  });

  it('falls back to CreationDate when ModDate missing', () => {
    const created = new Date('2023-08-01T12:00:00Z');
    expect(pickDateFromPdfInfoNode({ CreationDate: created })).toEqual(created);
  });

  it('rejects implausible years', () => {
    expect(pickDateFromPdfInfoNode({
      ModDate: new Date('1999-01-01T12:00:00Z'),
      CreationDate: new Date('2030-01-01T12:00:00Z'),
    })).toBeNull();
  });
});
