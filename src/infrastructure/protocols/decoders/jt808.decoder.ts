import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ProtocolDecoder } from '../../../application/ports/protocol-decoder.port';
import { Telemetry } from '../../../domain/entities/telemetry.entity';
import { Position } from '../../../domain/value-objects/position.vo';
import { TrackerBrand } from '../../../domain/value-objects/tracker-brand.vo';

/** JT/T 808 (China). Mensagem 0x0200 = report de posição. */
@Injectable()
export class Jt808Decoder implements ProtocolDecoder<any> {
  readonly protocol = 'jt808';
  canDecode(p: string) {
    return p === this.protocol;
  }

  decode(raw: any): Telemetry {
    return Telemetry.create({
      eventId: randomUUID(),
      vehicleId: raw.vehicleId,
      imei: raw.terminalId,
      brand: TrackerBrand.JT808,
      receivedAt: new Date(),
      position: Position.create({
        latitude: raw.lat / 1e6,
        longitude: raw.lng / 1e6,
        speed: raw.speed / 10,
        heading: raw.direction,
        altitude: raw.altitude,
        ignition: raw.acc,
        capturedAt: raw.time ? new Date(raw.time) : new Date(),
      }),
    });
  }
}
