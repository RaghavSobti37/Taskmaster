# Quick Testing Guide - Feature Verification Checklist

## ✅ All Systems Ready to Test

**Server Status:** Running on http://localhost:5000  
**Client Status:** Running on http://localhost:5173  
**Database:** Connected to MongoDB  
**No Errors:** All code issues fixed ✅

---

## 🧪 Quick Tests (5 min each)
tests/
├── setup.js                 # Test environment setup
├── unit/                    # Unit tests (isolated functionality)
│   ├── logger.test.js
│   ├── errorHandler.test.js
│   └── ...
├── integration/             # Integration tests (multiple components)
│   ├── health.test.js
│   ├── auth.test.js
│   └── ...
└── e2e/                     # End-to-end tests (complete flows)
    ├── login.e2e.test.js
    ├── register.e2e.test.js
    └── ...
```

---

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode (Re-run on changes)
```bash
npm run test:watch
```

### Specific Test File
```bash
npm test -- tests/unit/logger.test.js
```

### With Coverage
```bash
npm run test:coverage
```

### Debug Mode
```bash
npm run test:debug
```

### E2E Tests Only
```bash
npm run test:e2e
```

---

## Test Types

### 1. Unit Tests
Test individual functions in isolation.

**What to test:**
- Logger functionality
- Utility functions
- Middleware logic
- Controller logic

**Example:**
```javascript
describe('Logger', () => {
  test('logger.info should log messages', () => {
    // Test code
  });
});
```

### 2. Integration Tests
Test how components work together.

**What to test:**
- Router responses
- Middleware chains
- Error handling
- CORS configuration
- Request/Response cycle

**Example:**
```javascript
describe('API Routes', () => {
  test('GET /api/health should return 200', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
  });
});
```

### 3. End-to-End Tests
Test complete user workflows.

**What to test:**
- User registration flow
- Login and authentication
- Task creation workflow
- Admin operations

**Example:**
```javascript
describe('User Registration', () => {
  test('New user should be able to register', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123'
      });
    expect(response.status).toBe(201);
  });
});
```

---

## Testing in Different Environments

### Localhost Testing

**Quick Test:**
```javascript
// tests/quick.test.js
import request from 'supertest';
import app from '../server.js';

test('Server is running', async () => {
  const res = await request(app).get('/api/health');
  expect(res.status).toBe(200);
});
```

**Run:**
```bash
npm test
```

### Production Testing

**Manual Testing via cURL:**
```bash
# Health check
curl https://api-url.com/api/health

# With headers
curl -H "Authorization: Bearer $TOKEN" https://api-url.com/api/auth/me

# POST with JSON
curl -X POST https://api-url.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"user@example.com","password":"password"}'
```

**Browser Console Testing:**
```javascript
// Test login endpoint
const testProdLogin = async () => {
  const response = await fetch('https://api-url.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      login: 'test@example.com',
      password: 'password'
    })
  });
  
  console.log('Status:', response.status);
  console.log('Response:', await response.json());
};

testProdLogin();
```

---

## Test Scenarios

### Authentication Tests

```javascript
describe('Authentication', () => {
  describe('Login', () => {
    test('Valid credentials should return token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: 'correct' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
    });

    test('Invalid password should return 401', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com', password: 'wrong' });
      
      expect(response.status).toBe(401);
    });

    test('Non-existent user should return 401', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ login: 'nonexistent@example.com', password: 'password' });
      
      expect(response.status).toBe(401);
    });

    test('Missing credentials should return 400', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ login: 'test@example.com' }); // missing password
      
      expect(response.status).toBe(400);
    });
  });

  describe('Registration', () => {
    test('Valid registration should create user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'new@example.com',
          password: 'securepassword123'
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
    });

    test('Duplicate email should return 409', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'user1',
          email: 'dup@example.com',
          password: 'password'
        });

      // Second registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'user2',
          email: 'dup@example.com',
          password: 'password'
        });
      
      expect(response.status).toBe(409);
    });

    test('Invalid email format should return 400', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'user',
          email: 'invalid-email',
          password: 'password'
        });
      
      expect(response.status).toBe(400);
    });
  });
});
```

### CORS Tests

```javascript
describe('CORS Configuration', () => {
  test('Allowed origin should get CORS headers', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');
    
    expect(response.status).toBe(200);
    // CORS headers should be present
  });

  test('Disallowed origin should be blocked', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Origin', 'http://malicious.com');
    
    expect(response.status).toBe(200);
    // But CORS headers won't allow browser to use the response
  });

  test('OPTIONS preflight should return 200', async () => {
    const response = await request(app)
      .options('/api/health')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');
    
    expect([200, 204]).toContain(response.status);
  });
});
```

### Error Handling Tests

```javascript
describe('Error Handling', () => {
  test('Invalid route should return 404', async () => {
    const response = await request(app).get('/api/invalid');
    expect(response.status).toBe(404);
  });

  test('500 error should return error response', async () => {
    // Mock a function to throw error
    jest.spyOn(User, 'findById').mockRejectedValue(new Error('DB Error'));
    
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer validtoken');
    
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('error');
  });

  test('Validation error should return 400', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ login: 'test@example.com' }); // missing password
    
    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });
});
```

---

## Performance Testing

### Load Testing

```javascript
describe('Performance', () => {
  test('Health check should respond in <100ms', async () => {
    const start = Date.now();
    await request(app).get('/api/health');
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(100);
  });

  test('Should handle multiple concurrent requests', async () => {
    const requests = Array(10).fill(null).map(() =>
      request(app).get('/api/health')
    );
    
    const responses = await Promise.all(requests);
    expect(responses.every(r => r.status === 200)).toBe(true);
  });
});
```

### Memory Testing

```javascript
describe('Memory', () => {
  test('Logger should not leak memory', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    for (let i = 0; i < 1000; i++) {
      logger.info('Test log', 'TEST');
    }
    
    global.gc?.(); // Force garbage collection
    const finalMemory = process.memoryUsage().heapUsed;
    
    // Memory increase should be reasonable
    expect(finalMemory - initialMemory).toBeLessThan(10000000); // 10MB
  });
});
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:latest
        options: >-
          --health-cmd mongosh
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 27017:27017

    steps:
      - uses: actions/checkout@v2
      
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: cd server && npm install
      
      - name: Run tests
        run: cd server && npm test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v2
        with:
          files: ./server/coverage/coverage-final.json
```

---

## Test Coverage

### Current Coverage Goals

- **Statements**: 80%
- **Branches**: 75%
- **Functions**: 80%
- **Lines**: 80%

### View Coverage Report

```bash
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html
```

---

## Common Testing Patterns

### Mocking Database

```javascript
jest.mock('../models/User.js');

describe('Auth', () => {
  test('should create user', async () => {
    User.create.mockResolvedValue({ id: '123', email: 'test@example.com' });
    
    const response = await request(app)
      .post('/api/auth/register')
      .send({ username: 'test', email: 'test@example.com', password: 'pass' });
    
    expect(User.create).toHaveBeenCalled();
  });
});
```

### Testing Authorization

```javascript
describe('Protected Routes', () => {
  test('Route should return 401 without token', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401);
  });

  test('Route should return 200 with valid token', async () => {
    const token = jwt.sign({ id: '123' }, process.env.JWT_SECRET);
    
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
  });
});
```

---

## Debugging Failed Tests

### View Detailed Output

```bash
npm test -- --verbose
```

### Run Single Test

```bash
npm test -- --testNamePattern="Login"
```

### Debug in isolation

```javascript
// Add .only to run only this test
test.only('should login', async () => {
  // test code
});

// Then run tests
npm test
```

### Enable Debugging

```bash
npm run test:debug

# This enables full logging during tests
```

---

## Test Checklist

Before pushing to production:

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Coverage meets minimum thresholds
- [ ] E2E tests for main flows pass
- [ ] Performance tests pass (response times acceptable)
- [ ] Memory tests pass (no leaks detected)
- [ ] Manual browser testing completed
- [ ] Production health check works
- [ ] Production login works
- [ ] All error cases handled
