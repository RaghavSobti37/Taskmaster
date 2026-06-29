import { Global, Logger, Module, OnModuleInit } from '@nestjs/common';
import mongoose from 'mongoose';
import { AppConfigModule } from '../../config/config.module';
import { AppConfigService } from '../../config/config.service';

/**
 * Minimal Mongo bootstrap — reuses legacy Mongoose models from `server/models`.
 * Scaffold only; swap to Nest MongooseModule when models are ported.
 */
@Global()
@Module({
  imports: [AppConfigModule],
})
export class DatabaseModule implements OnModuleInit {
  private readonly log = new Logger(DatabaseModule.name);

  constructor(private readonly config: AppConfigService) {}

  async onModuleInit() {
    const uri =
      this.config.get('MONGODB_URI') ||
      this.config.get('MONGO_URI') ||
      '';

    if (!uri) {
      this.log.warn('MONGODB_URI unset — mail processors will fail DB writes');
      return;
    }

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri);
      this.log.log('Mongo connected');
    }
  }
}
