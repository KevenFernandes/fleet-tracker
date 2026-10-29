import { Module } from '@nestjs/common';
import { CacheModule } from './infrastructure/cache/cache.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { HttpModule } from './infrastructure/http/http.module';
import { ProtocolsModule } from './infrastructure/protocols/protocols.module';

// API não consome do broker — apenas publica.
import { MessagingModule } from './infrastructure/messaging/messaging.module';
import { RabbitmqBrokerAdapter } from './infrastructure/messaging/rabbitmq/rabbitmq-broker.adapter';
import { RabbitmqService } from './infrastructure/messaging/rabbitmq/rabbitmq.service';

@Module({
  imports: [DatabaseModule, CacheModule, ProtocolsModule, HttpModule, MessagingModule],
  providers: [RabbitmqService, { provide: 'MessageBroker', useClass: RabbitmqBrokerAdapter }],
  exports: ['MessageBroker'],
})
export class AppApiModule {}
