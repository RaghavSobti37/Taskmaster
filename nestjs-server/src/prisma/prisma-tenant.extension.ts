import { Prisma } from '@prisma/client';
import type { TenantContextService } from '../tenant/tenant-context.service';

const WRITE_OPS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
]);

const READ_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);

type QueryArgs = Record<string, unknown>;

type TenantQueryParams = {
  operation: string;
  args: Record<string, unknown>;
  query: (args: Record<string, unknown>) => Promise<unknown>;
};

function mergeTenantWhere(
  where: QueryArgs | undefined,
  tenantId: string,
): QueryArgs {
  if (!where) return { tenantId };
  return { AND: [where, { tenantId }] };
}

/** update/delete by unique id — AND wrapper breaks Prisma WhereUniqueInput */
function scopeWriteWhere(
  where: QueryArgs | undefined,
  tenantId: string,
): QueryArgs {
  if (!where) return { tenantId };
  const keys = Object.keys(where);
  const key = keys[0];
  if (keys.length === 1 && key && (key === 'id' || key.includes('_'))) {
    return { ...where, tenantId };
  }
  return mergeTenantWhere(where, tenantId);
}

function injectTenantData(
  data: QueryArgs | QueryArgs[] | undefined,
  tenantId: string,
): QueryArgs | QueryArgs[] | undefined {
  if (!data) return data;
  if (Array.isArray(data)) {
    return data.map((row) => ({ ...row, tenantId: row.tenantId ?? tenantId }));
  }
  return { ...data, tenantId: data.tenantId ?? tenantId };
}

/**
 * Prisma Client Extension — auto-injects tenantId on queries (replaces tenantQuery.js).
 * Respects TenantContextService.bypassTenant for auth lookups and admin bypass.
 */
export function createTenantExtension(tenantContext: TenantContextService) {
  return Prisma.defineExtension({
    name: 'tenantScope',
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }: TenantQueryParams) {
          if (tenantContext.isBypassTenant()) {
            return query(args);
          }

          const tenantId = tenantContext.getTenantId();
          const nodeEnv = process.env.NODE_ENV ?? 'development';
          if (!tenantId) {
            if (nodeEnv === 'production') {
              throw new Error('tenantId required: missing tenant context in production');
            }
            return query(args);
          }

          const nextArgs = { ...args } as Record<string, unknown>;

          if (READ_OPS.has(operation)) {
            nextArgs.where = mergeTenantWhere(
              nextArgs.where as QueryArgs | undefined,
              tenantId,
            );
          }

          if (WRITE_OPS.has(operation)) {
            if ('where' in nextArgs && nextArgs.where) {
              nextArgs.where = scopeWriteWhere(
                nextArgs.where as QueryArgs,
                tenantId,
              );
            }
            if ('data' in nextArgs) {
              nextArgs.data = injectTenantData(
                nextArgs.data as QueryArgs | QueryArgs[] | undefined,
                tenantId,
              );
            }
            if ('create' in nextArgs) {
              nextArgs.create = injectTenantData(
                nextArgs.create as QueryArgs | undefined,
                tenantId,
              );
            }
            if ('update' in nextArgs) {
              nextArgs.update = nextArgs.update ?? {};
            }
          }

          return query(nextArgs);
        },
      },
    },
  });
}

export type ExtendedPrismaClient = ReturnType<
  typeof createExtendedPrismaClient
>;

export function createExtendedPrismaClient(
  baseClient: Prisma.DefaultPrismaClient,
  tenantContext: TenantContextService,
) {
  return baseClient.$extends(createTenantExtension(tenantContext));
}
