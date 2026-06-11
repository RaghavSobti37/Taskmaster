import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TenantContextService } from '../tenant/tenant-context.service';
import {
  createExtendedPrismaClient,
  type ExtendedPrismaClient,
} from './prisma-tenant.extension';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  readonly db: ExtendedPrismaClient;

  constructor(private readonly tenantContext: TenantContextService) {
    super();
    this.db = createExtendedPrismaClient(this, tenantContext);
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Prisma connected');
    } catch (err) {
      this.logger.warn(
        `Prisma connect skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Run query with tenant bypass (auth lookup, cross-tenant admin). */
  withBypass<T>(fn: () => Promise<T>): Promise<T> {
    const store = this.tenantContext.getStore();
    const context = {
      tenantId: store?.tenantId ?? null,
      userId: store?.userId ?? null,
      traceId: store?.traceId ?? null,
      bypassTenant: true,
    };
    return Promise.resolve(this.tenantContext.run(context, fn));
  }
}
