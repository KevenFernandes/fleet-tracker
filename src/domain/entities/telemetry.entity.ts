import { Position } from '../value-objects/position.vo';
import { TrackerBrand } from '../value-objects/tracker-brand.vo';

export class Telemetry {
  private constructor(
    public readonly eventId: string,
    public readonly vehicleId: string,
    public readonly imei: string,
    public readonly brand: TrackerBrand,
    public readonly position: Position,
    public readonly receivedAt: Date,
  ) {}

  static create(input: {
    eventId: string;
    vehicleId: string;
    imei: string;
    brand: TrackerBrand;
    position: Position;
    receivedAt: Date;
  }): Telemetry {
    return new Telemetry(
      input.eventId,
      input.vehicleId,
      input.imei,
      input.brand,
      input.position,
      input.receivedAt,
    );
  }
}
