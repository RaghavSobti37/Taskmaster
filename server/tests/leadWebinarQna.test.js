const { buildWebinarQnaItems, formatQnaText, isYesNoFlag } = require('../../shared/leadWebinarQna.cjs');

describe('leadWebinarQna', () => {
  it('ignores yes/no flags on qnaAnswered', () => {
    expect(formatQnaText('Yes')).toBeNull();
    expect(isYesNoFlag('Not sure')).toBe(true);
    expect(buildWebinarQnaItems({ qnaAnswered: 'Yes' })).toEqual([]);
  });

  it('returns long-form qnaAnswered text', () => {
    const text = 'Q: What is your goal?\nA: I want to sing professionally.';
    const items = buildWebinarQnaItems({ qnaAnswered: text });
    expect(items).toHaveLength(1);
    expect(items[0].value).toBe(text);
  });

  it('extracts Q&A from metadata question/answer pairs', () => {
    const items = buildWebinarQnaItems({
      metadata: {
        'Question 1': 'How long have you been singing?',
        'Answer 1': 'About 5 years',
        artistType: 'Hobbyist',
      },
    });
    expect(items.some((i) => i.value.includes('5 years'))).toBe(true);
  });

  it('extracts qna answered metadata column', () => {
    const items = buildWebinarQnaItems({
      metadata: {
        'QnA Answered': 'Interested in vocal training and stage performance',
      },
    });
    expect(items[0].value).toBe('Interested in vocal training and stage performance');
  });
});
