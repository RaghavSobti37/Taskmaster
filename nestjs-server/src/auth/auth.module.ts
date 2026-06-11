import { Global, Module } from '@nestjs/common';

import { AuthGuard } from './auth.guard';

import { AuthService } from './auth.service';

import { TokenRevocationService } from './token-revocation.service';



@Global()

@Module({

  providers: [AuthService, TokenRevocationService, AuthGuard],

  exports: [AuthService, TokenRevocationService, AuthGuard],

})

export class AuthModule {}

