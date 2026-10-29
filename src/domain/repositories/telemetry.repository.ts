import { Telemetry } from '../entities/telemetry.entity';
import { VehicleState } from './vehicle.repository';

export interface TelemetryRepository {
  saveWithStateAndEvent(
    telemetry: Telemetry,
    state: VehicleState,
    events: { type: string; payload: unknown; occurredAt: Date }[],
  ): Promise<void>;
  isEventProcessed(eventId: string): Promise<boolean>;
  markEventProcessed(eventId: string): Promise<void>;
}
