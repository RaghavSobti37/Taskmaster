function contributionPct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

describe('workspace goals contribution', () => {
  test('contributionPct calculates share of workspace total', () => {
    expect(contributionPct(25, 100)).toBe(25);
    expect(contributionPct(0, 0)).toBe(0);
    expect(contributionPct(3, 10)).toBe(30);
  });
});
