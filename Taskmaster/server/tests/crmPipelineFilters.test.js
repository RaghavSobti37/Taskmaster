const {
  mergeLeadStatusOptions,
  canonicalLeadStatus,
  warmPipelineQuery,
  isWarmPipelineRequest,
  leadStatusFilterValue,
} = require('../utils/crmPipelineFilters');

describe('crmPipelineFilters', () => {
  it('dedupes Warm and warm in status options', () => {
    const merged = mergeLeadStatusOptions(['Warm', 'warm', 'New'], ['Converted']);
    expect(merged).toContain('Warm');
    expect(merged).toContain('New');
    expect(merged.filter((s) => s.toLowerCase() === 'warm')).toHaveLength(1);
  });

  it('canonicalLeadStatus normalizes casing', () => {
    expect(canonicalLeadStatus('warm')).toBe('Warm');
    expect(canonicalLeadStatus('CONVERTED')).toBe('Converted');
  });

  it('warmPipelineQuery matches meaningful connect YES', () => {
    expect(warmPipelineQuery()).toEqual({
      meaningfulConnect: 'YES',
    });
  });

  it('isWarmPipelineRequest accepts common truthy values', () => {
    expect(isWarmPipelineRequest({ warmPipeline: 'true' })).toBe(true);
    expect(isWarmPipelineRequest({ warmPipeline: '1' })).toBe(true);
    expect(isWarmPipelineRequest({ warmPipeline: 'false' })).toBe(false);
  });

  it('leadStatusFilterValue is case-insensitive', () => {
    expect(leadStatusFilterValue('Warm')).toEqual({ $regex: /^Warm$/i });
    expect(leadStatusFilterValue('warm')).toEqual({ $regex: /^warm$/i });
  });
});
