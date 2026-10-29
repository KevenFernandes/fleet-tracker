import { Inject, Injectable } from '@nestjs/common';
import { Telemetry } from '../../domain/entities/telemetry.entity';
import { RABBITMQ_EXCHANGES } from '../../infrastructure/messaging/topology';
import { MessageBroker } from '../ports/message-broker.port';

/**
 * Ingestion: só faz o roteamento. Não persiste nada.
 * Publica com routing key = IMEI para o exchange x-consistent-hash.
 */
@Injectable()
export class IngestTelemetryUseCase {
  constructor(@Inject('MessageBroker') private readonly broker: MessageBroker) {}

  async execute(telemetry: Telemetry): Promise<void> {
    await this.broker.publish(
      RABBITMQ_EXCHANGES.TRACKING_RAW,
      telemetry.imei, // ← routing key = IMEI (hash ring)
      this.toPayload(telemetry),
      { persistent: true, messageId: telemetry.eventId },
    );
  }

  private toPayload(t: Telemetry) {
    return {
      eventId: t.eventId,
      vehicleId: t.vehicleId,
      imei: t.imei,
      brand: t.brand,
      receivedAt: t.receivedAt.toISOString(),
      position: {
        latitude: t.position.latitude,
        longitude: t.position.longitude,
        speed: t.position.speed,
        heading: t.position.heading,
        altitude: t.position.altitude,
        ignition: t.position.ignition,
        capturedAt: t.position.capturedAt.toISOString(),
      },
    };
  }
}
