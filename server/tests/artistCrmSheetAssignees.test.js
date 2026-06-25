const {
  resolveAssigneeKeyFromSheetName,
  ASSIGNEE_KEYS,
} = require('../../shared/artistCrmSheetAssignees');
const {
  extractAssigneeTokensFromSheetName,
  matchAssigneeFromSheetName,
  matchAssigneeToken,
} = require('../utils/artistCallAssignees');

describe('artistCrmSheetAssignees rules', () => {
  test('maps sheets per business rules (not suffix names)', () => {
    expect(resolveAssigneeKeyFromSheetName('Awards & Summits')?.assigneeKey).toBe(ASSIGNEE_KEYS.HARSHIKA);
    expect(resolveAssigneeKeyFromSheetName('Maharashtra Colleges - Harshika')?.assigneeKey).toBe(ASSIGNEE_KEYS.AKASH);
    expect(resolveAssigneeKeyFromSheetName('Private Shows - Akash')?.assigneeKey).toBe(ASSIGNEE_KEYS.DEEPANK);
    expect(resolveAssigneeKeyFromSheetName('Live Gig Venue - Deepank')?.assigneeKey).toBe(ASSIGNEE_KEYS.DEEPANK);
    expect(resolveAssigneeKeyFromSheetName('ICCR- State Govt. Contact Details - RS')?.assigneeKey).toBe(ASSIGNEE_KEYS.AKASH);
    expect(resolveAssigneeKeyFromSheetName('Govt. Cultural Department - RS')?.assigneeKey).toBe(ASSIGNEE_KEYS.ROHITH);
    expect(resolveAssigneeKeyFromSheetName('Kabir Cafe, Agnee, Parvaaz data - RS')?.assigneeKey).toBe(ASSIGNEE_KEYS.ROHITH);
    expect(resolveAssigneeKeyFromSheetName('For YUGM- Kabir Cafe Performace data - harshika')?.assigneeKey).toBe(ASSIGNEE_KEYS.HARSHIKA);
  });
});

describe('artistCallAssignees sheet name', () => {
  const reps = [
    { _id: '1', name: 'Akash Kumar' },
    { _id: '2', name: 'Rohith Sharma' },
    { _id: '3', name: 'Harshika Patel' },
    { _id: '9', name: 'Deepank Soni' },
  ];

  test('extracts tokens after dash', () => {
    expect(extractAssigneeTokensFromSheetName('Private Shows - Akash')).toEqual(['Akash']);
    expect(extractAssigneeTokensFromSheetName('Sponsors - Akash & Harshika')).toEqual(['Akash', 'Harshika']);
  });

  test('matchAssigneeFromSheetName uses rules before suffix', () => {
    const hit = matchAssigneeFromSheetName('Live Gig Venue - Deepank', reps);
    expect(hit.assigneeName).toBe('Deepank Soni');
    expect(hit.source).toBe('sheet_rule');

    const colleges = matchAssigneeFromSheetName('Maharashtra Colleges - Harshika', reps);
    expect(colleges.assigneeName).toBe('Akash Kumar');
    expect(colleges.source).toBe('sheet_rule');
  });

  test('matchAssigneeToken handles first name', () => {
    expect(matchAssigneeToken('Akash', reps[0])).toBe(true);
    expect(matchAssigneeToken('Rohith', reps[1])).toBe(true);
  });
});
