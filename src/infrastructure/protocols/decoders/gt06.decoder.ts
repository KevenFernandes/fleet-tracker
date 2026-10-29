import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ProtocolDecoder } from '../../../application/ports/protocol-decoder.port';
import { Telemetry } from '../../../domain/entities/telemetry.entity';
import { Position } from '../../../domain/value-objects/position.vo';
import { TrackerBrand } from '../../../domain/value-objects/tracker-brand.vo';

/**
 * Esqueleto do decoder GT06 (protocolo binário Concox).
 * O parser real precisa tratar o frame 0x12 (location packet).
 * Aqui recebemos o frame já parcialmente parseado como entrada.
 */
@Injectable()
export class Gt06Decoder implements ProtocolDecoder<{
  imei: string;
  vehicleId: string;
  lat: number;
  lng: number;
  speed: number;
  course: number;
  altitude: number;
  acc: boolean;
  gpsTime: Date;
}> {
  readonly protocol = 'gt06';
  canDecode(p: string) {
    return p === this.protocol;
  }

  decode(raw: any): Telemetry {
    return Telemetry.create({
      eventId: randomUUID(),
      vehicleId: raw.vehicleId,
      imei: raw.imei,
      brand: TrackerBrand.GT06,
      receivedAt: new Date(),
      position: Position.create({
        latitude: raw.lat,
        longitude: raw.lng,
        speed: raw.speed,
        heading: raw.course,
        altitude: raw.altitude,
        ignition: raw.acc,
        capturedAt: raw.gpsTime ? new Date(raw.gpsTime) : new Date(),
      }),
    });
  }
}
