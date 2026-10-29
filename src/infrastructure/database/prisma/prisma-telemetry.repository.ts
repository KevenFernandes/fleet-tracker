import { Injectable } from '@nestjs/common';
import { Telemetry } from '../../../domain/entities/telemetry.entity';
import { TelemetryRepository } from '../../../domain/repositories/telemetry.repository';
import { VehicleState } from '../../../domain/repositories/vehicle.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaTelemetryRepository implements TelemetryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveWithStateAndEvent(
    telemetry: Telemetry,
    state: VehicleState,
    events: { type: string; payload: unknown; occurredAt: Date }[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.position.create({
        data: {
          eventId: telemetry.eventId,
          vehicleId: telemetry.vehicleId,
          latitude: telemetry.position.latitude,
          longitude: telemetry.position.longitude,
          speed: telemetry.position.speed,
          heading: telemetry.position.heading,
          altitude: telemetry.position.altitude,
          ignition: telemetry.position.ignition,
          odometer: state.odometer,
          capturedAt: telemetry.position.capturedAt,
          receivedAt: telemetry.receivedAt,
        },
      });

      await tx.vehicleState.upsert({
        where: { vehicleId: state.vehicleId },
        create: state,
        update: state,
      });

      if (events.length) {
        await tx.event.createMany({
          data: events.map((e) => ({
            vehicleId: telemetry.vehicleId,
            type: e.type,
            payload: e.payload as object,
            occurredAt: e.occurredAt,
          })),
        });
      }
    });
  }

  async isEventProcessed(eventId: string): Promise<boolean> {
    const found = await this.prisma.processedEvent.findUnique({
      where: { eventId },
    });
    return !!found;
  }

  async markEventProcessed(eventId: string): Promise<void> {
    await this.prisma.processedEvent.create({ data: { eventId } }).catch(() => undefined); // idempotente: já existe, ignora
  }
}
