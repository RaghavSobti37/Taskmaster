const {
  isMasterclassOffering,
  masterclassName,
  mentorFromTitle,
} = require('../services/masterclassFunnelReport');

describe('masterclassFunnelReport helpers', () => {
  it('detects masterclass from title', () => {
    expect(isMasterclassOffering({ title: 'Live Masterclass by Sandesh' }, null)).toBe(true);
    expect(isMasterclassOffering({ title: 'Comprehensive Course by Sandesh' }, null)).toBe(false);
  });

  it('parses masterclass display name', () => {
    expect(
      masterclassName('20th Jan | 7 pm | The heART of Music Composition - Live Masterclass by Sandesh'),
    ).toBe('The heART of Music Composition');
  });

  it('extracts mentor from title', () => {
    expect(mentorFromTitle('Unfold Yourself with Sandesh Shandilya - Exclusive Live Masterclass')).toBe(
      'Sandesh Shandilya',
    );
  });
});
