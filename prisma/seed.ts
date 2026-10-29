import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_VEHICLES = [
  {
    id: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
    imei: '123456789012345',
    plate: 'ABC-1D23',
    brand: 'Scania',
    model: 'R450',
    active: true,
  },
  {
    id: 'e391f2ff-7d65-4c12-91f7-e812859f1962',
    imei: '987654321098765',
    plate: 'XYZ-9K87',
    brand: 'Volvo',
    model: 'FH 540',
    active: true,
  },
  {
    id: 'f402a3aa-8e76-4d23-a2a8-f923960a2073',
    imei: '112233445566778',
    plate: 'BRA-2E19',
    brand: 'Mercedes-Benz',
    model: 'Sprinter 416',
    active: true,
  },
  {
    id: 'a513b4bb-9f87-4e34-b3b9-a034071b3184',
    imei: '998877665544332',
    plate: 'KXZ-3F44',
    brand: 'Volkswagen',
    model: 'Delivery 11.180',
    active: true,
  },
];

async function main() {
  console.log('🌱 Iniciando seed de veículos de demonstração...');

  for (const vehicle of DEMO_VEHICLES) {
    const upserted = await prisma.vehicle.upsert({
      where: { imei: vehicle.imei },
      update: {
        plate: vehicle.plate,
        brand: vehicle.brand,
        model: vehicle.model,
        active: vehicle.active,
      },
      create: vehicle,
    });
    console.log(
      `  ✓ Veículo pronto: [${upserted.brand} ${upserted.model}] - Placa: ${upserted.plate} | IMEI: ${upserted.imei} (ID: ${upserted.id})`,
    );
  }

  console.log(`\n🎉 Seed concluído com sucesso! ${DEMO_VEHICLES.length} veículos prontos para teste.`);
}

main()
  .catch((e) => {
    console.error('❌ Erro durante a execução do seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
