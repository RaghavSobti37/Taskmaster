const { collectPreflightIssues } = require('../scripts/preflightEnv');

describe('preflightEnv retired hosts', () => {
  test('flags retired tracking host', () => {
    const { errors } = collectPreflightIssues({
      JWT_SECRET: 'test-secret',
      MONGODB_URI: 'mongodb://localhost:27017/taskmaster_local',
      TRACKING_BASE_URL: 'https://taskmaster-jfw0.onrender.com',
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /retired host/i.test(e))).toBe(true);
  });

  test('allows env-configured API host', () => {
    const { errors } = collectPreflightIssues({
      JWT_SECRET: 'test-secret',
      MONGODB_URI: 'mongodb://localhost:27017/taskmaster_local',
      TRACKING_BASE_URL: 'https://api.example.test',
      SERVER_URL: 'https://api.example.test',
    });
    expect(errors).toHaveLength(0);
  });
});
