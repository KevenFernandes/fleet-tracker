import { BadRequestException, Body, Controller, Inject, Param, Post } from '@nestjs/common';
import { IngestTelemetryUseCase } from '../../application/use-cases/ingest-telemetry.use-case';
import { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import { ProtocolDecoderRegistry } from '../protocols/protocol-decoder.registry';

@Controller('ingest')
export class IngestionController {
  constructor(
    private readonly registry: ProtocolDecoderRegistry,
    private readonly ingestUC: IngestTelemetryUseCase,
    @Inject('VehicleRepository') private readonly vehicles: VehicleRepository,
  ) {}

  @Post(':protocol')
  async ingest(@Param('protocol') protocol: string, @Body() body: any) {
    const decoder = this.registry.get(protocol);

    // Resolve vehicleId a partir do IMEI
    const imei = body.imei ?? body.terminalId;
    const vehicleId = await this.vehicles.findIdByImei(imei);
    if (!vehicleId) throw new BadRequestException(`Unknown IMEI: ${imei}`);

    const telemetry = decoder.decode({ ...body, vehicleId });
    await this.ingestUC.execute(telemetry);
    return { accepted: true, eventId: telemetry.eventId };
  }
}
