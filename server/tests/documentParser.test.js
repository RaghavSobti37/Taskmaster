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
  });

  it('does not treat entrepreneur substring as EUR', () => {
    const meta = parseMetadataFromText('blog topics for online music entrepreneur academy 2026');
    expect(meta.currency).toBe('INR');
  });
});
