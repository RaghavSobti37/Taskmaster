/**
 * Unit checks for artist booking assignee + booked-calls source matching.
 */
const { isBookedCallSource } = require('../../shared/dataInlets');
const { normalizePayload } = require('../services/artistEnquiryService');
const { resolvePrimaryCallAssigneeId, findUserByPatterns } = require('../utils/primaryCallAssignee');

describe('artist booking pipeline helpers', () => {
  it('treats Website Artist Enquiry as booked-call source', () => {
    expect(isBookedCallSource('Website Artist Enquiry')).toBe(true);
    expect(isBookedCallSource('Website Booking')).toBe(true);
  });

  it('normalizes TSC /query payload aliases', () => {
    const n = normalizePayload({
      organization: 'Acme Corp',
      engagementType: 'Live show',
      artistTalent: 'YUGM',
      projectNature: 'Festival',
      whenAndWhere: 'Delhi',
    });
    expect(n.company).toBe('Acme Corp');
    expect(n.collaborationType).toBe('Live show');
    expect(n.artist).toBe('YUGM');
    expect(n.nature).toBe('Festival');
    expect(n.whenWhere).toBe('Delhi');
  });

  it('findUserByPatterns matches Akash by name', async () => {
    const user = await findUserByPatterns([/akash/i], 'artist-management');
    if (!user) {
      console.warn('No Akash in test DB — skip assignee assertion');
      return;
    }
    expect(user.name.toLowerCase()).toContain('akash');
    const id = await resolvePrimaryCallAssigneeId();
    expect(String(id)).toBe(String(user._id));
  });
});
