import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getRuntimeHostname,
  isLocalHostname,
  isLocalViteDev,
  isProductionAppHost,
} from './runtimeEnv';

describe('runtimeEnv', () => {
  const env = import.meta.env;

  afterEach(() => {
    vi.unstubAllGlobals();
    env.DEV = true;
  });

  it('detects localhost', () => {
    expect(isLocalHostname('localhost')).toBe(true);
    expect(isLocalHostname('127.0.0.1')).toBe(true);
    expect(isLocalHostname('tsccoreknot.com')).toBe(false);
  });

  it('isLocalViteDev requires localhost even when DEV is true', () => {
    env.DEV = true;
    vi.stubGlobal('window', { location: { hostname: 'tsccoreknot.com' } });
    expect(isLocalViteDev()).toBe(false);
    vi.stubGlobal('window', { location: { hostname: 'localhost' } });
    expect(isLocalViteDev()).toBe(true);
  });

  it('isLocalViteDev is false on production host when DEV is false', () => {
    env.DEV = false;
    vi.stubGlobal('window', { location: { hostname: 'tsccoreknot.com' } });
    expect(isLocalViteDev()).toBe(false);
  });

  it('isProductionAppHost matches tsccoreknot.com family', () => {
    expect(isProductionAppHost('tsccoreknot.com')).toBe(true);
    expect(isProductionAppHost('auth.tsccoreknot.com')).toBe(true);
    expect(isProductionAppHost('localhost')).toBe(false);
    expect(isProductionAppHost('foo.vercel.app')).toBe(false);
  });

  it('getRuntimeHostname reads window', () => {
    vi.stubGlobal('window', { location: { hostname: 'tsccoreknot.com' } });
    expect(getRuntimeHostname()).toBe('tsccoreknot.com');
  });
});
