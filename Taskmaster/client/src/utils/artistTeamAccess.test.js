import { isUserOnArtistTeam } from './artistTeamAccess';

describe('isUserOnArtistTeam', () => {
  const user = { _id: 'user-1' };

  it('returns false when user or team missing', () => {
    expect(isUserOnArtistTeam(null, ['user-1'])).toBe(false);
    expect(isUserOnArtistTeam(user, null)).toBe(false);
    expect(isUserOnArtistTeam(user, [])).toBe(false);
  });

  it('matches raw member ids', () => {
    expect(isUserOnArtistTeam(user, ['user-2', 'user-1'])).toBe(true);
    expect(isUserOnArtistTeam(user, ['user-2'])).toBe(false);
  });

  it('matches populated member objects', () => {
    expect(isUserOnArtistTeam(user, [{ _id: 'user-1' }])).toBe(true);
    expect(isUserOnArtistTeam(user, [{ _id: 'user-2' }])).toBe(false);
  });
});
