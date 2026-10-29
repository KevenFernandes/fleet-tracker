import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ProtocolDecoder } from '../../../application/ports/protocol-decoder.port';
import { Telemetry } from '../../../domain/entities/telemetry.entity';
import { Position } from '../../../domain/value-objects/position.vo';
import { TrackerBrand } from '../../../domain/value-objects/tracker-brand.vo';

@Injectable()
export class GenericJsonDecoder implements ProtocolDecoder<any> {
  readonly protocol = 'generic-json';
  canDecode(p: string) {
    return p === this.protocol;
  }

  decode(raw: any): Telemetry {
    return Telemetry.create({
      eventId: raw.eventId ?? randomUUID(),
      vehicleId: raw.vehicleId,
      imei: raw.imei,
      brand: TrackerBrand.GENERIC,
      receivedAt: new Date(),
      position: Position.create({
        latitude: Number(raw.lat),
        longitude: Number(raw.lng),
        speed: Number(raw.speed ?? 0),
        heading: Number(raw.heading ?? 0),
        altitude: Number(raw.altitude ?? 0),
        ignition: Boolean(raw.ignition),
        capturedAt: raw.capturedAt ? new Date(raw.capturedAt) : new Date(),
      }),
    });
  }
}
