import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceController } from '../src/domains/attendance/attendance.controller';
import { AttendanceService } from '../src/domains/attendance/attendance.service';
import { AttendanceMetricsService } from '../src/domains/attendance/attendance-metrics.service';
import { AuthGuard } from '../src/auth/auth.guard';
import { AuthService } from '../src/auth/auth.service';
import { AppConfigService } from '../src/config/config.service';
import { TokenRevocationService } from '../src/auth/token-revocation.service';
import { TenantContextService } from '../src/tenant/tenant-context.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { HealthController } from '../src/health/health.controller';

function createHttpContext(cookies: Record<string, string> = {}) {
  const request = {
    cookies,
    headers: {},
    ip: '127.0.0.1',
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
  } as ExecutionContext;
}

describe('Attendance (e2e)', () => {
  let authGuard: AuthGuard;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AttendanceController],
      providers: [
        AuthGuard,
        TenantContextService,
        {
          provide: AppConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'JWT_SECRET') return 'test-secret';
              if (key === 'NODE_ENV') return 'test';
              return '';
            },
          },
        },
        {
          provide: TokenRevocationService,
          useValue: { isTokenRevoked: jest.fn().mockResolvedValue(false) },
        },
        {
          provide: PrismaService,
          useValue: {
            withBypass: (fn: () => unknown) => fn(),
            user: { findUnique: jest.fn() },
            $queryRaw: jest.fn().mockResolvedValue([1]),
          },
        },
        {
          provide: AuthService,
          useValue: {
            loadAuthUser: jest.fn(),
            touchLastOnline: jest.fn(),
            loadBypassAdminUser: jest.fn(),
          },
        },
        { provide: AttendanceService, useValue: { listAttendance: jest.fn() } },
        { provide: AttendanceMetricsService, useValue: {} },
      ],
    }).compile();

    authGuard = moduleFixture.get(AuthGuard);
  });

  it('health endpoint shape is reachable without auth', async () => {
    const health = new HealthController(
      {
        $queryRaw: jest.fn().mockResolvedValue([1]),
      } as unknown as PrismaService,
      {
        get: (key: string) => {
          if (key === 'NODE_ENV') return 'development';
          if (key === 'REDIS_URL') return '';
          return '';
        },
      } as unknown as AppConfigService,
    );

    const payload = await health.getHealth();
    expect(payload).toMatchObject({
      ok: expect.any(Boolean),
      status: expect.any(String),
    });
  });

  it('attendance routes reject requests without cookie (401)', async () => {
    await expect(authGuard.canActivate(createHttpContext())).rejects.toMatchObject({
      response: { error: 'Not authorized, no token' },
    });
    await expect(authGuard.canActivate(createHttpContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
