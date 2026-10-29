import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as mqtt from 'mqtt';
import { IngestTelemetryUseCase } from '../../application/use-cases/ingest-telemetry.use-case';
import { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import { ProtocolDecoderRegistry } from '../protocols/protocol-decoder.registry';

@Injectable()
export class MqttIngestionService implements OnModuleInit {
  private readonly logger = new Logger(MqttIngestionService.name);

  constructor(
    private readonly registry: ProtocolDecoderRegistry,
    private readonly ingestUC: IngestTelemetryUseCase,
    @Inject('VehicleRepository') private readonly vehicles: VehicleRepository,
  ) {}

  async onModuleInit() {
    const url = process.env.MQTT_URL;
    if (!url) return this.logger.warn('MQTT_URL not set — skipping MQTT ingest');

    const client = mqtt.connect(url);
    client.on('connect', () => {
      this.logger.log(`MQTT connected: ${url}`);
      client.subscribe('trackers/+/+', { qos: 1 });
    });

    client.on('message', async (topic, payload) => {
      try {
        const [, protocol, imei] = topic.split('/');
        const body = JSON.parse(payload.toString());
        const vehicleId = await this.vehicles.findIdByImei(imei);
        if (!vehicleId) return this.logger.warn(`Unknown IMEI: ${imei}`);

        const telemetry = this.registry.get(protocol).decode({
          ...body,
          imei,
          vehicleId,
        });
        await this.ingestUC.execute(telemetry);
      } catch (err) {
        this.logger.error(`MQTT ingest error: ${(err as Error).message}`);
      }
    });
  }
}
