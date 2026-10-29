import { Module } from '@nestjs/common';
import { IngestTelemetryUseCase } from '../../application/use-cases/ingest-telemetry.use-case';
import { IngestionController } from './ingestion.controller';
import { MqttIngestionService } from './mqtt-ingestion.service';

@Module({
  controllers: [IngestionController],
  providers: [IngestTelemetryUseCase, MqttIngestionService],
  exports: [IngestTelemetryUseCase],
})
export class HttpModule {}
