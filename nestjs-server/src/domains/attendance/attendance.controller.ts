import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  attendanceCheckBody,
  attendanceQuery,
  approveAttendanceBody,
  leaveRequestBody,
  leaveRequestsQuery,
  leaveReviewBody,
  upsertAttendanceBody,
} from '@coreknot/contracts';
import { AuthGuard } from '../../auth/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthUser } from '../../auth/auth.types';
import { LegacyErrorFilter } from '../../common/filters/legacy-error.filter';
import { AttendanceService } from './attendance.service';

@Controller('attendance')
@UseGuards(AuthGuard)
@UseFilters(LegacyErrorFilter)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(attendanceQuery)) query: Record<string, string>,
  ) {
    return this.attendanceService.listAttendance(user, query);
  }

  @Post('check')
  check(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(attendanceCheckBody)) body: Record<string, string>,
  ) {
    return this.attendanceService.checkInOut(user, body);
  }

  @Post('check/undo')
  undoCheck(
    @CurrentUser() user: AuthUser,
    @Body() body: { type?: 'in' | 'out' },
  ) {
    return this.attendanceService.undoCheck(user, body);
  }

  @Patch(':id/approve')
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(approveAttendanceBody)) body: Record<string, string>,
  ) {
    return this.attendanceService.approveAttendance(user, id, body as never);
  }

  @Put('upsert/by-user-date')
  upsert(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(upsertAttendanceBody)) body: Record<string, unknown>,
  ) {
    return this.attendanceService.upsertByUserDate(user, body as never);
  }

  @Post('leave')
  @HttpCode(201)
  createLeave(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(leaveRequestBody)) body: { fromDate: string; toDate: string; reason?: string },
  ) {
    return this.attendanceService.createLeaveRequest(user, body);
  }

  @Get('leave/requests')
  leaveRequests(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(leaveRequestsQuery)) query: Record<string, string>,
  ) {
    return this.attendanceService.listLeaveRequests(user, query);
  }

  @Patch('leave/requests/:id/approve')
  approveLeave(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.attendanceService.approveLeaveRequest(user, id);
  }

  @Patch('leave/requests/:id/reject')
  rejectLeave(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(leaveReviewBody)) body: { reviewNote?: string },
  ) {
    return this.attendanceService.rejectLeaveRequest(user, id, body.reviewNote);
  }

  @Delete('reset')
  reset(@CurrentUser() user: AuthUser) {
    return this.attendanceService.resetAll(user);
  }
}
