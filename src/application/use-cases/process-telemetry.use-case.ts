import { Inject, Injectable, Logger } from '@nestjs/common';
import { Telemetry } from '../../domain/entities/telemetry.entity';
import { TelemetryRepository } from '../../domain/repositories/telemetry.repository';
import { VehicleRepository, VehicleState } from '../../domain/repositories/vehicle.repository';
import { Position } from '../../domain/value-objects/position.vo';
import { TrackerBrand } from '../../domain/value-objects/tracker-brand.vo';
import { Cache } from '../ports/cache.port';

interface TelemetryPayload {
  eventId: string;
  vehicleId: string;
  imei: string;
  brand: TrackerBrand;
  receivedAt: string;
  position: {
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    altitude: number;
    ignition: boolean;
    capturedAt: string;
  };
}

@Injectable()
export class ProcessTelemetryUseCase {
  private readonly logger = new Logger(ProcessTelemetryUseCase.name);

  constructor(
    @Inject('TelemetryRepository')
    private readonly telemetryRepo: TelemetryRepository,
    @Inject('VehicleRepository')
    private readonly vehicleRepo: VehicleRepository,
    @Inject('Cache') private readonly cache: Cache,
  ) {}

  async execute(payload: TelemetryPayload): Promise<void> {
    // 1) Idempotência durável (Postgres)
    if (await this.telemetryRepo.isEventProcessed(payload.eventId)) {
      this.logger.debug(`Duplicate event ${payload.eventId} — skipped`);
      return;
    }

    // 2) Reconstituir agregado
    const telemetry = Telemetry.create({
      eventId: payload.eventId,
      vehicleId: payload.vehicleId,
      imei: payload.imei,
      brand: payload.brand,
      receivedAt: new Date(payload.receivedAt),
      position: Position.create({
        ...payload.position,
        capturedAt: new Date(payload.position.capturedAt),
      }),
    });

    // 3) Estado anterior do veículo (última posição, odômetro)
    const prevState = await this.vehicleRepo.getState(telemetry.vehicleId);

    // 4) Descarte de eventos atrasados (out-of-order do mundo real)
    if (prevState && telemetry.position.capturedAt <= prevState.lastTimestamp) {
      this.logger.warn(`Late event ${telemetry.eventId} for ${telemetry.imei} — discarded`);
      await this.telemetryRepo.markEventProcessed(telemetry.eventId);
      return;
    }

    // 5) Regras de negócio — agora SIM na ordem certa
    const events = this.evaluateRules(prevState, telemetry);

    // 6) Novo estado
    const newState: VehicleState = {
      vehicleId: telemetry.vehicleId,
      lastLat: telemetry.position.latitude,
      lastLng: telemetry.position.longitude,
      lastSpeed: telemetry.position.speed,
      lastIgnition: telemetry.position.ignition,
      odometer: (prevState?.odometer ?? 0) + (prevState ? this.haversine(prevState, telemetry) : 0),
      lastTimestamp: telemetry.position.capturedAt,
    };

    // 7) Persistência transacional (position + state + events + processed_event)
    await this.telemetryRepo.saveWithStateAndEvent(telemetry, newState, events);
    await this.telemetryRepo.markEventProcessed(telemetry.eventId);

    // 8) Cache quente para consultas de "última posição"
    await this.cache.set(`vehicle:${telemetry.vehicleId}:state`, newState, 60 * 60);
    await this.cache.geoAdd(
      'vehicles:live',
      telemetry.position.longitude,
      telemetry.position.latitude,
      telemetry.vehicleId,
    );
  }

  private evaluateRules(prev: VehicleState | null, t: Telemetry) {
    const events: { type: string; payload: unknown; occurredAt: Date }[] = [];

    if (prev && !prev.lastIgnition && t.position.ignition) {
      events.push({
        type: 'IGNITION_ON',
        payload: { lat: t.position.latitude, lng: t.position.longitude },
        occurredAt: t.position.capturedAt,
      });
    }
    if (prev && prev.lastIgnition && !t.position.ignition) {
      events.push({
        type: 'IGNITION_OFF',
        payload: { lat: t.position.latitude, lng: t.position.longitude },
        occurredAt: t.position.capturedAt,
      });
    }
    if (t.position.speed > 120) {
      events.push({
        type: 'OVERSPEED',
        payload: { speed: t.position.speed },
        occurredAt: t.position.capturedAt,
      });
    }
    return events;
  }

  private haversine(a: VehicleState, t: Telemetry): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(t.position.latitude - a.lastLat);
    const dLon = toRad(t.position.longitude - a.lastLng);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lastLat)) * Math.cos(toRad(t.position.latitude)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
}
