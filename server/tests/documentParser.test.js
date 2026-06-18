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
