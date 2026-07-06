import { Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/auth.types';
import { SyncService } from './sync.service';

@Controller('v1/sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('token')
  @UseGuards(AuthGuard)
  issueToken(@CurrentUser() user: AuthUser) {
    return this.syncService.issueSyncToken(user);
  }
}
