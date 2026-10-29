import { Global, Module } from '@nestjs/common';
import { IngestTelemetryUseCase } from '../../application/use-cases/ingest-telemetry.use-case';
import { ProcessTelemetryUseCase } from '../../application/use-cases/process-telemetry.use-case';
import { ConvoyConsumerService } from './convoy-consumer.service';
import { RabbitmqBrokerAdapter } from './rabbitmq/rabbitmq-broker.adapter';
import { RabbitmqService } from './rabbitmq/rabbitmq.service';

@Global()
@Module({
  providers: [
    RabbitmqService,
    { provide: 'MessageBroker', useClass: RabbitmqBrokerAdapter },
    ProcessTelemetryUseCase,
    IngestTelemetryUseCase,
    ConvoyConsumerService,
  ],
  exports: ['MessageBroker', IngestTelemetryUseCase],
})
export class MessagingModule {}
