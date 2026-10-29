export interface VehicleState {
  vehicleId: string;
  lastLat: number;
  lastLng: number;
  lastSpeed: number;
  lastIgnition: boolean;
  odometer: number;
  lastTimestamp: Date;
}

export interface VehicleRepository {
  findIdByImei(imei: string): Promise<string | null>;
  getState(vehicleId: string): Promise<VehicleState | null>;
}
