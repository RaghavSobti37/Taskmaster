import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDisconnect = vi.fn();
const mockIo = vi.fn(() => ({
  connected: false,
  disconnect: mockDisconnect,
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
}));

vi.mock('socket.io-client', () => ({
  io: (...args) => mockIo(...args),
}));

vi.mock('../utils/apiBase', () => ({
  getRealtimeOrigin: () => 'http://localhost:5173',
  isCrossOriginRealtime: () => false,
  apiPath: (path) => path,
}));

describe('realtime connect', () => {
  beforeEach(async () => {
    vi.resetModules();
    mockIo.mockClear();
    mockDisconnect.mockClear();
    const { disconnectRealtime } = await import('./realtime');
    disconnectRealtime();
  });

  it('reuses the same socket while still connecting', async () => {
    const { connect } = await import('./realtime');

    connect();
    await vi.waitFor(() => expect(mockIo).toHaveBeenCalledTimes(1));

    const first = connect();
    const second = connect();

    expect(first).toBe(second);
    expect(mockIo).toHaveBeenCalledTimes(1);
    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  it('creates a fresh socket after explicit disconnect', async () => {
    const { connect, disconnectRealtime } = await import('./realtime');

    connect();
    await vi.waitFor(() => expect(mockIo).toHaveBeenCalledTimes(1));
    disconnectRealtime();
    connect();
    await vi.waitFor(() => expect(mockIo).toHaveBeenCalledTimes(2));

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
});
