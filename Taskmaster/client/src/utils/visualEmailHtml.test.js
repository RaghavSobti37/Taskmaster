import { describe, it, expect } from 'vitest';
import {
  buildVisualPasteHtml,
  canonicalizeVisualMailHtml,
  quillIndentLevelFromClass,
  sanitizePastedVisualMailHtml,
} from './visualEmailHtml';

describe('canonicalizeVisualMailHtml', () => {
  it('inlines ql-indent classes to padding-left', () => {
    const out = canonicalizeVisualMailHtml('<p class="ql-indent-2">Indented</p>');
    expect(out).toMatch(/padding-left\s*:\s*6em!important/i);
    expect(out).not.toMatch(/ql-indent/i);
  });

  it('preserves inline padding-left values', () => {
    const out = canonicalizeVisualMailHtml('<p style="padding-left: 3em">Indented</p>');
    expect(out).toMatch(/padding-left\s*:\s*3em!important/i);
  });

  it('converts empty paragraphs to nbsp spacers', () => {
    const out = canonicalizeVisualMailHtml('<p>one</p><p><br></p><p>two</p>');
    expect(out).toContain('one');
    expect(out).toContain('two');
    expect(out).toMatch(/&nbsp;/i);
    expect(out).not.toMatch(/<p><br><\/p>/i);
  });

  it('stacks indent levels across multiple lines', () => {
    const html = [
      '<p>Flush</p>',
      '<p class="ql-indent-1">One</p>',
      '<p class="ql-indent-2">Two</p>',
    ].join('');
    const out = canonicalizeVisualMailHtml(html);
    expect(out).toMatch(/padding-left\s*:\s*3em!important/i);
    expect(out).toMatch(/padding-left\s*:\s*6em!important/i);
  });

  it('flattens accidental Quill lists so preview does not inherit list indent', () => {
    const html = [
      '<ul>',
      '<li>National Recognition: Semi-finalists</li>',
      '<li>Top Honors: Awarded</li>',
      '<li>Industry Pedigree: Duhita is a Gold Medalist</li>',
      '<li>What We Offer For Your Stage:</li>',
      '<li>We provide a dynamic live spectacle.</li>',
      '<li>Wishing you the Best,</li>',
      '</ul>',
    ].join('');
    const out = canonicalizeVisualMailHtml(html);
    expect(out).not.toMatch(/<ul|<li/i);
    expect(out).toContain('What We Offer For Your Stage');
    expect(out).toContain('Wishing you the Best');
  });
});

describe('quillIndentLevelFromClass', () => {
  it('reads highest ql-indent level from class list', () => {
    expect(quillIndentLevelFromClass('ql-indent-1 ql-indent-3')).toBe(3);
  });
});

describe('sanitizePastedVisualMailHtml', () => {
  it('strips foreign margin-left and padding-left from pasted HTML blocks', () => {
    const out = sanitizePastedVisualMailHtml(
      '<div style="margin-left:36pt;padding-left:24px;text-indent:18px">Hello</div>',
    );
    expect(out).not.toMatch(/margin-left|padding-left|text-indent/i);
    expect(out).toContain('Hello');
    expect(out).not.toContain('&lt;div');
  });

  it('removes phantom empty blocks sandwiched between content (Gmail-style)', () => {
    const out = sanitizePastedVisualMailHtml([
      '<div dir="ltr">',
      '<div>Hi Team,</div>',
      '<div><br></div>',
      '<div>I hope you are doing well.</div>',
      '</div>',
    ].join(''));
    expect(out).toContain('Hi Team,');
    expect(out).toContain('I hope you are doing well.');
    expect(out).not.toMatch(/<p[^>]*>\s*(?:<br\s*\/?>)?\s*<\/p>/i);
  });

  it('maps plain-text paste: single newline to br, blank line to new paragraph', () => {
    const out = sanitizePastedVisualMailHtml('Hi Team,\n\nI hope you are doing well.\nSecond line.');
    expect(out).toMatch(/Hi Team,/);
    expect(out).toMatch(/<br\s*\/?>/i);
    expect(out).toMatch(/Second line/);
    expect(out.match(/<p/gi)?.length).toBeGreaterThanOrEqual(2);
  });

  it('strips ql-indent on paste (toolbar re-applies after paste)', () => {
    const out = sanitizePastedVisualMailHtml('<p class="ql-indent-2">Indented</p>');
    expect(out).not.toMatch(/ql-indent/i);
    expect(out).toContain('Indented');
  });

  it('flattens accidental pasted lists to paragraphs', () => {
    const out = sanitizePastedVisualMailHtml(
      '<ul><li>National Recognition: Semi-finalists</li><li>Top Honors: Awarded</li></ul>',
    );
    expect(out).not.toMatch(/<ul|<li/i);
    expect(out).toContain('National Recognition');
    expect(out).toContain('Top Honors');
  });

  it('uses plain text structure with HTML formatting (bold + links)', () => {
    const plain = 'Led by Harshad and Duhita.\n\nWatch Live: https://www.youtube.com/watch?v=abc';
    const html = [
      '<div>Led by <strong>Harshad</strong> and <em>Duhita</em>.</div>',
      '<div>Watch Live: <a href="https://www.youtube.com/watch?v=abc">https://www.youtube.com/watch?v=abc</a></div>',
    ].join('');

    const out = buildVisualPasteHtml(plain, html);
    expect(out).toMatch(/<strong>Harshad<\/strong>/i);
    expect(out).toMatch(/<em>Duhita<\/em>/i);
    expect(out).toMatch(/<a[^>]+href="https:\/\/www\.youtube\.com/i);
    expect(out).not.toMatch(/<ul|<li|padding-left|ql-indent/i);
  });

  it('keeps real bullet lists when plain text lines start with bullet markers', () => {
    const plain = '• First item\n• Second item';
    const html = '<ul><li>First item</li><li>Second item</li></ul>';
    const out = buildVisualPasteHtml(plain, html);
    expect(out).toMatch(/<ul/i);
    expect(out).toMatch(/<li/i);
    expect(out).toContain('First item');
    expect(out).toContain('Second item');
  });

  it('builds outreach-style paste as flush paragraphs, not nested lists', () => {
    const plain = [
      'Career Highlights:',
      '',
      'National Recognition: Semi-finalists on Sony TV.',
      'Top Honors: Awarded the prestigious Padma Shri award.',
      'Industry Pedigree: Duhita is a Gold Medalist.',
      '',
      'What We Offer For Your Stage:',
      '',
      'We provide a dynamic, multi genre live spectacle.',
      '',
      'Wishing you the Best,',
    ].join('\n');

    const html = [
      '<ul>',
      '<li>National Recognition: Semi-finalists on Sony TV.</li>',
      '<li>Top Honors: Awarded the prestigious Padma Shri award.</li>',
      '<li>Industry Pedigree: Duhita is a Gold Medalist.</li>',
      '<li>What We Offer For Your Stage:</li>',
      '<li>We provide a dynamic, multi genre live spectacle.</li>',
      '<li>Wishing you the Best,</li>',
      '</ul>',
    ].join('');

    const out = buildVisualPasteHtml(plain, html);
    expect(out).not.toMatch(/<ul|<li/i);
    expect(out).toContain('What We Offer For Your Stage');
    expect(out).toContain('Wishing you the Best');
    expect(out).not.toMatch(/padding-left|margin-left|ql-indent/i);
  });
});
