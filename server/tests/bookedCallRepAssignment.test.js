const {
  pickNextRepFromList,
  createBookedCallRepAssigner,
} = require('../utils/bookedCallRepRoundRobin');

function demo() {
  const reps = [
    { _id: 'aaa', name: 'Rep A' },
    { _id: 'bbb', name: 'Rep B' },
    { _id: 'ccc', name: 'Rep C' },
  ];

  console.assert(String(pickNextRepFromList(reps, null)) === 'aaa', 'first rep');
  console.assert(String(pickNextRepFromList(reps, 'aaa')) === 'bbb', 'second rep');
  console.assert(String(pickNextRepFromList(reps, 'bbb')) === 'ccc', 'third rep');
  console.assert(String(pickNextRepFromList(reps, 'ccc')) === 'aaa', 'wrap rep');
  console.assert(String(pickNextRepFromList(reps, 'removed')) === 'aaa', 'unknown last');

  const next = createBookedCallRepAssigner(['aaa', 'bbb']);
  console.assert(next() === 'aaa' && next() === 'bbb' && next() === 'aaa', 'assigner cycles');

  console.log('bookedCallRepRoundRobin: all checks passed');
}

if (require.main === module) {
  demo();
}

module.exports = { demo };
