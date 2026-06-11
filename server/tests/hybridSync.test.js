const {
  STORE,
  REDIS_CACHE_KEYS,
  getSyncTargetForEvent,
} = require('../../shared/dataOwnership');
const { mapTaskRow, mapAttendanceRow, mapTaskActivityRow } = require('../services/sync/syncPayloadMappers');
const { handleDomainSyncJob } = require('../services/sync/handlers/routeSyncHandler');
const { writeToSupabase } = require('../services/sync/handlers/supabaseSyncWriter');
const { writeToMongo } = require('../services/sync/handlers/mongoSyncWriter');
const { publishDomainEvent } = require('../services/sync/eventBus');
const taskReadRepo = require('../domains/tasks/repositories/taskReadRepository');

jest.mock('../services/supabase/restQuery', () => ({
  upsertRows: jest.fn(async () => ({ count: 1 })),
  deleteRows: jest.fn(async () => ({})),
  selectRows: jest.fn(async () => []),
}));

jest.mock('../config/supabase', () => ({
  isSupabaseEnabled: jest.fn(() => true),
}));

const { upsertRows } = require('../services/supabase/restQuery');

describe('hybrid sync Phase 2–5', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('declares attendance + task list cache keys', () => {
    expect(REDIS_CACHE_KEYS.ATTENDANCE_STATS).toContain('{userId}');
    expect(REDIS_CACHE_KEYS.TASK_LIST_COUNTS).toContain('{tenantId}');
  });

  it('maps task payload for Supabase upsert', () => {
    const row = mapTaskRow({
      _id: '64b2fc63f1a2b3c4d5e6f789',
      tenantId: '64b2fc63f1a2b3c4d5e6f001',
      title: 'Pilot task',
      status: 'todo',
      createdBy: '64b2fc63f1a2b3c4d5e6f002',
    });
    expect(row.id).toBe('64b2fc63f1a2b3c4d5e6f789');
    expect(row.tenantId).toBe('64b2fc63f1a2b3c4d5e6f001');
    expect(row.createdById).toBe('64b2fc63f1a2b3c4d5e6f002');
  });

  it('routes task.activity to Mongo writer path', () => {
    expect(getSyncTargetForEvent('task.activity')).toBe(STORE.MONGO);
    expect(getSyncTargetForEvent('attendance.checked')).toBe(STORE.SUPABASE);
  });

  it('supabase writer upserts Task rows', async () => {
    const result = await writeToSupabase('Task', {
      _id: '64b2fc63f1a2b3c4d5e6f789',
      tenantId: '64b2fc63f1a2b3c4d5e6f001',
      title: 'Sync me',
    }, { eventType: 'task.created' });

    expect(result.upserted).toBe(true);
    expect(upsertRows).toHaveBeenCalledWith(
      'Task',
      expect.arrayContaining([expect.objectContaining({ id: '64b2fc63f1a2b3c4d5e6f789' })]),
      { onConflict: 'id' },
    );
  });

  it('mongo writer skips duplicate task.activity', async () => {
    const TaskActivity = require('../domains/tasks/models/TaskActivity');
    const findSpy = jest.spyOn(TaskActivity, 'findById').mockReturnValue({
      setOptions: () => ({ lean: async () => ({ _id: '64b2fc63f1a2b3c4d5e6f789' }) }),
    });

    const payload = mapTaskActivityRow({
      _id: '64b2fc63f1a2b3c4d5e6f789',
      taskId: '64b2fc63f1a2b3c4d5e6f790',
      actorId: '64b2fc63f1a2b3c4d5e6f791',
      type: 'message',
      body: 'hi',
    });

    const result = await writeToMongo('TaskActivity', payload, { eventType: 'task.activity' });
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('already_exists');
    findSpy.mockRestore();
  });

  it('publishDomainEvent queues in test memory fallback', async () => {
    const out = await publishDomainEvent('task.updated', {
      id: 'abc',
      tenantId: 't1',
      title: 'x',
      updatedAt: '2026-06-10',
    });
    expect(out.queued).toBe(true);
    expect(out.queue).toMatch(/memory|domain-sync/);
  });

  it('shadow-compare maps Supabase row to Mongo API shape', () => {
    const mongo = {
      _id: '64b2fc63f1a2b3c4d5e6f789',
      title: 'A',
      status: 'todo',
      tenantId: '64b2fc63f1a2b3c4d5e6f001',
    };
    const supabase = taskReadRepo.mapSupabaseRowToMongoShape({
      id: mongo._id,
      title: mongo.title,
      status: mongo.status,
      tenantId: mongo.tenantId,
    });
    expect(supabase._id).toBe(mongo._id);
    expect(supabase.title).toBe(mongo.title);
    expect(supabase._readSource).toBe('supabase');
  });

  it('attendance mapper preserves userId + date', () => {
    const row = mapAttendanceRow({
      _id: '64b2fc63f1a2b3c4d5e6f789',
      userId: '64b2fc63f1a2b3c4d5e6f001',
      date: new Date('2026-06-10'),
    });
    expect(row.userId).toBe('64b2fc63f1a2b3c4d5e6f001');
    expect(row.date).toContain('2026');
  });

  it('routeSyncHandler processes supabase target jobs', async () => {
    const result = await handleDomainSyncJob({
      id: 'job-1',
      data: {
        eventType: 'task.updated',
        payload: {
          id: '64b2fc63f1a2b3c4d5e6f789',
          tenantId: '64b2fc63f1a2b3c4d5e6f001',
          title: 'Updated',
        },
      },
    });
    expect(result.upserted).toBe(true);
  });
});
