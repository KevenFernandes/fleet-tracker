import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';
import { AppApiModule } from './app-api.module';

async function bootstrap() {
  const app = await NestFactory.create(AppApiModule);
  app.enableShutdownHooks();

  const PORT = process.env.APP_PORT ?? 3000;

  await app.listen(PORT, async () => {
    console.log(`API listening on ${await app.getUrl()}`);
  });

  process.on('SIGTERM', async () => {
    console.log('SIGTERM recebido. Fechando API com segurança...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT (Ctrl+C) recebido. Fechando API...');
    await app.close();
    process.exit(0);
  });
}
bootstrap();
