const { CRON_JOBS, QUEUE_WORKERS, listJobs } = require('../jobs/registry');

describe('jobs/registry + bootstrap', () => {
  it('lists cron and queue workers', () => {
    const { cron, workers } = listJobs();
    expect(cron.length).toBeGreaterThan(0);
    expect(workers.length).toBeGreaterThan(0);
    expect(cron.every((j) => j.id && j.module && j.init)).toBe(true);
    expect(workers.every((j) => j.id && j.module && j.init)).toBe(true);
  });

  it('deduplicates shared init handlers', () => {
    const cronKeys = CRON_JOBS.map((j) => `${j.module}::${j.init}`);
    const workerKeys = QUEUE_WORKERS.map((j) => `${j.module}::${j.init}`);
    const unique = new Set([...cronKeys, ...workerKeys]);
    expect(unique.size).toBeLessThan(CRON_JOBS.length + QUEUE_WORKERS.length);
  });

  it('registry has deduplicated init keys for bootstrap', () => {
    const all = [...CRON_JOBS, ...QUEUE_WORKERS];
    const unique = new Set(all.map((j) => `${j.module}::${j.init}`));
    expect(unique.size).toBeGreaterThan(0);
    expect(unique.size).toBeLessThan(all.length);
    expect(all.length).toBe(CRON_JOBS.length + QUEUE_WORKERS.length);
  });
});
