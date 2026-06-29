const {
  isOpenMetricSatisfied,
  isClickMetricSatisfied,
} = require('../utils/trackingClaim');

describe('trackingClaim engagement helpers', () => {
  it('treats Opened and Clicked as open-metric satisfied', () => {
    expect(isOpenMetricSatisfied('Opened')).toBe(true);
    expect(isOpenMetricSatisfied('Clicked')).toBe(true);
    expect(isOpenMetricSatisfied('Sent')).toBe(false);
    expect(isOpenMetricSatisfied('Pending')).toBe(false);
  });

  it('only Clicked satisfies click metric', () => {
    expect(isClickMetricSatisfied('Clicked')).toBe(true);
    expect(isClickMetricSatisfied('Opened')).toBe(false);
    expect(isClickMetricSatisfied('Sent')).toBe(false);
  });
});
