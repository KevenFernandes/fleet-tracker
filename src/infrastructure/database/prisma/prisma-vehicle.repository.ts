import { Injectable } from '@nestjs/common';
import { VehicleRepository, VehicleState } from '../../../domain/repositories/vehicle.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaVehicleRepository implements VehicleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findIdByImei(imei: string): Promise<string | null> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { imei },
      select: { id: true },
    });
    return vehicle?.id ?? null;
  }

  async getState(vehicleId: string): Promise<VehicleState | null> {
    const state = await this.prisma.vehicleState.findUnique({ where: { vehicleId } });

    return state;
  }
}
