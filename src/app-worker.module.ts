import { Module } from '@nestjs/common';
import { CacheModule } from './infrastructure/cache/cache.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { MessagingModule } from './infrastructure/messaging/messaging.module';

@Module({
  imports: [DatabaseModule, CacheModule, MessagingModule],
})
export class AppWorkerModule {}
