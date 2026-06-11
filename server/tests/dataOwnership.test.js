const {
  STORE,
  getStoreForEntity,
  isLockedMongoEntity,
  getSyncTargetForEvent,
  DOMAIN_SYNC_EVENT_TYPES,
} = require('../../shared/dataOwnership');

describe('dataOwnership registry', () => {
  it('routes structured entities to Supabase', () => {
    expect(getStoreForEntity('Task')).toBe(STORE.SUPABASE);
    expect(getStoreForEntity('User')).toBe(STORE.SUPABASE);
    expect(getStoreForEntity('Lead')).toBe(STORE.SUPABASE);
  });

  it('keeps MailEvent and TaskActivity on Mongo', () => {
    expect(getStoreForEntity('MailEvent')).toBe(STORE.MONGO);
    expect(getStoreForEntity('TaskActivity')).toBe(STORE.MONGO);
    expect(isLockedMongoEntity('MailEvent')).toBe(true);
  });

  it('routes task.activity events to Mongo', () => {
    expect(getSyncTargetForEvent('task.activity')).toBe(STORE.MONGO);
    expect(getSyncTargetForEvent('task.created')).toBe(STORE.SUPABASE);
  });

  it('declares domain sync event types', () => {
    expect(DOMAIN_SYNC_EVENT_TYPES).toContain('lead.updated');
    expect(DOMAIN_SYNC_EVENT_TYPES.length).toBeGreaterThan(5);
  });

  it('declares hybrid cache key patterns', () => {
    const { REDIS_CACHE_KEYS } = require('../../shared/dataOwnership');
    expect(REDIS_CACHE_KEYS.ATTENDANCE_STATS).toContain('attendance:stats');
    expect(REDIS_CACHE_KEYS.TASK_LIST_COUNTS).toContain('tasks:counts');
  });
});
