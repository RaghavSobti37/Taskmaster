import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantStore {
  tenantId: string | null;
  userId: string | null;
  traceId: string | null;
  bypassTenant?: boolean;
}

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantStore>();

  run<T>(context: TenantStore, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  getStore(): TenantStore | undefined {
    return this.storage.getStore();
  }

  getTenantId(): string | null {
    return this.storage.getStore()?.tenantId ?? null;
  }

  getUserId(): string | null {
    return this.storage.getStore()?.userId ?? null;
  }

  getTraceId(): string | null {
    return this.storage.getStore()?.traceId ?? null;
  }

  isBypassTenant(): boolean {
    return this.storage.getStore()?.bypassTenant === true;
  }

  /** Merge into active store (set by TraceMiddleware before guards run). */
  updateContext(partial: Partial<TenantStore>): void {
    const store = this.storage.getStore();
    if (store) Object.assign(store, partial);
  }
}
