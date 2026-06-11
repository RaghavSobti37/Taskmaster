import { Injectable } from '@nestjs/common';
import * as contracts from '@coreknot/contracts';

@Injectable()
export class AppService {
  getHealth() {
    const hasContracts = typeof contracts === 'object' && contracts !== null;
    return {
      status: 'ok',
      service: '@coreknot/nestjs-server',
      contractsLoaded: hasContracts,
    };
  }
}
