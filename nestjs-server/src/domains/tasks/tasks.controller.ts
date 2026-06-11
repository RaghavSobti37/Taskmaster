import { Controller, Get, Param, UseFilters, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LegacyErrorFilter } from '../../common/filters/legacy-error.filter';
import { AuthUser } from '../../auth/auth.types';
import { TasksService } from './tasks.service';

/**
 * Read-only Supabase/Prisma pilot — strangler target for task reads.
 * Writes remain on Express + Mongo until Phase 2 cutover.
 */
@Controller('tasks')
@UseGuards(AuthGuard)
@UseFilters(LegacyErrorFilter)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasksService.findById(user, id);
  }
}
