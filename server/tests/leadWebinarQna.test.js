const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildWebinarQnaItems, formatQnaText, isYesNoFlag } = require('../../shared/leadWebinarQna.cjs');

describe('leadWebinarQna', () => {
  it('ignores yes/no flags on qnaAnswered', () => {
    assert.equal(formatQnaText('Yes'), null);
    assert.equal(isYesNoFlag('Not sure'), true);
    assert.deepEqual(buildWebinarQnaItems({ qnaAnswered: 'Yes' }), []);
  });

  it('returns long-form qnaAnswered text', () => {
    const text = 'Q: What is your goal?\nA: I want to sing professionally.';
    const items = buildWebinarQnaItems({ qnaAnswered: text });
    assert.equal(items.length, 1);
    assert.equal(items[0].value, text);
  });

  it('extracts Q&A from metadata question/answer pairs', () => {
    const items = buildWebinarQnaItems({
      metadata: {
        'Question 1': 'How long have you been singing?',
        'Answer 1': 'About 5 years',
        artistType: 'Hobbyist',
      },
    });
    assert.ok(items.some((i) => i.value.includes('5 years')));
  });

  it('extracts qna answered metadata column', () => {
    const items = buildWebinarQnaItems({
      metadata: {
        'QnA Answered': 'Interested in vocal training and stage performance',
      },
    });
    assert.equal(items[0].value, 'Interested in vocal training and stage performance');
  });
});
