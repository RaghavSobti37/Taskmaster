const { finishAuthSession } = require('../../utils/sessionRegistry');
const { COOKIE_NAME } = require('../../utils/authCookie');

const mockAuthReq = () => ({
  headers: { host: 'localhost:5000' },
  ip: '127.0.0.1',
  get(name) {
    const key = String(name || '').toLowerCase();
    if (key === 'host') return 'localhost:5000';
    return '';
  },
});

const mockAuthRes = () => {
  const jar = {};
  return {
    cookie(name, value) {
      jar[name] = value;
    },
    clearCookie() {},
    getHeader: () => undefined,
    getHeaders: () => ({}),
    getCookie(name) {
      return jar[name];
    },
  };
};

/** Mint CoreKnot session cookie on supertest agent — no HTTP /login. */
async function mintSessionAgent(agent, userId, options = {}) {
  const req = mockAuthReq();
  const res = mockAuthRes();
  const activeTenantId = options?.activeTenantId ? String(options.activeTenantId) : null;
  await finishAuthSession(req, res, userId, activeTenantId);
  const token = res.getCookie(COOKIE_NAME);
  if (!token) {
    throw new Error(`mintSessionAgent: no session token for user ${userId}`);
  }
  return agent.set('Cookie', `${COOKIE_NAME}=${token}`);
}

module.exports = {
  mintSessionAgent,
  mockAuthReq,
  mockAuthRes,
};
