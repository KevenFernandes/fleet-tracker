import { Global, Module } from '@nestjs/common';

import { PrismaTelemetryRepository } from './prisma/prisma-telemetry.repository';
import { PrismaVehicleRepository } from './prisma/prisma-vehicle.repository';
import { PrismaService } from './prisma/prisma.service';

@Global()
@Module({
  providers: [
    PrismaService,
    { provide: 'TelemetryRepository', useClass: PrismaTelemetryRepository },
    { provide: 'VehicleRepository', useClass: PrismaVehicleRepository },
  ],
  exports: [PrismaService, 'TelemetryRepository', 'VehicleRepository'],
})
export class DatabaseModule {}
