import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';
import { AppWorkerModule } from './app-worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppWorkerModule);
  console.log(`Worker started on partition ${process.env.PARTITION}`);
  // mantém vivo

  app.enableShutdownHooks();

  process.on('SIGTERM', async () => {
    console.log('SIGTERM recebido. Fechando worker com segurança...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT (Ctrl+C) recebido. Fechando worker...');
    await app.close();
    process.exit(0);
  });
}
bootstrap();
