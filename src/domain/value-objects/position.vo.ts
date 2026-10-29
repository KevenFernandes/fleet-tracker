export class Position {
  private constructor(
    public readonly latitude: number,
    public readonly longitude: number,
    public readonly speed: number,
    public readonly heading: number,
    public readonly altitude: number,
    public readonly ignition: boolean,
    public readonly capturedAt: Date,
  ) {}

  static create(input: {
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    altitude: number;
    ignition: boolean;
    capturedAt: Date;
  }): Position {
    if (input.latitude < -90 || input.latitude > 90)
      throw new Error(`Invalid latitude: ${input.latitude}`);
    if (input.longitude < -180 || input.longitude > 180)
      throw new Error(`Invalid longitude: ${input.longitude}`);
    if (input.speed < 0 || input.speed > 300) throw new Error(`Invalid speed: ${input.speed}`);
    return new Position(
      input.latitude,
      input.longitude,
      input.speed,
      input.heading,
      input.altitude,
      input.ignition,
      input.capturedAt,
    );
  }
}
