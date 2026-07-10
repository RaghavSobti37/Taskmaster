const {
  pickNextRepFromList,
  createBookedCallRepAssigner,
} = require('../utils/bookedCallRepRoundRobin');

describe('bookedCallRepRoundRobin', () => {
  const reps = [
    { _id: 'aaa', name: 'Rep A' },
    { _id: 'bbb', name: 'Rep B' },
    { _id: 'ccc', name: 'Rep C' },
  ];

  it('cycles reps in order and wraps', () => {
    expect(String(pickNextRepFromList(reps, null))).toBe('aaa');
    expect(String(pickNextRepFromList(reps, 'aaa'))).toBe('bbb');
    expect(String(pickNextRepFromList(reps, 'bbb'))).toBe('ccc');
    expect(String(pickNextRepFromList(reps, 'ccc'))).toBe('aaa');
    expect(String(pickNextRepFromList(reps, 'removed'))).toBe('aaa');
  });

  it('assigner cycles through configured ids', () => {
    const next = createBookedCallRepAssigner(['aaa', 'bbb']);
    expect(next()).toBe('aaa');
    expect(next()).toBe('bbb');
    expect(next()).toBe('aaa');
  });
});
