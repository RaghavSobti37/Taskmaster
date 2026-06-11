import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { TenantModule } from './tenant/tenant.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BullMQModule } from './bullmq/bullmq.module';
import { HealthModule } from './health/health.module';
import { AttendanceModule } from './domains/attendance/attendance.module';
import { TasksModule } from './domains/tasks/tasks.module';
import { MailModule } from './domains/mail/mail.module';
import { TraceMiddleware } from './common/middleware/trace.middleware';

@Module({})
export class AppModule implements NestModule {
  static register(options: { enableBullMQ: boolean }): DynamicModule {
    const imports = [
      AppConfigModule,
      TenantModule,
      PrismaModule,
      AuthModule,
      HealthModule,
      AttendanceModule,
      TasksModule,
    ];
    if (options.enableBullMQ) {
      imports.push(BullMQModule, MailModule);
    }
    return { module: AppModule, imports };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TraceMiddleware).forRoutes('*');
  }
}
