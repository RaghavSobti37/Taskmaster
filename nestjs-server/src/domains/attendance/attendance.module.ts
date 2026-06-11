import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceMetricsService } from './attendance-metrics.service';

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceMetricsService],
})
export class AttendanceModule {}
