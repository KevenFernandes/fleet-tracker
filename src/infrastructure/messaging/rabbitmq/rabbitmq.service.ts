import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { TOPOLOGY } from '../topology';

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqService.name);
  private connection!: amqp.ChannelModel;
  private channel!: amqp.Channel;

  async onModuleInit() {
    const url = process.env.RABBITMQ_URL!;
    this.connection = await amqp.connect(url);
    this.channel = await this.connection.createChannel();
    await this.channel.prefetch(1); //diz ao consumidor processar uma mensagem por vez

    // Abaixo as configuracoes da infraestrutura do rabbitmq
    // durable => se o rabbit reiniciar, a mensagem deve permanecer (exchanges e queues)

    for (const ex of TOPOLOGY.exchanges) {
      // Agencia do correio => decide para qual fila a mensagem deve ir
      await this.channel.assertExchange(ex.name, ex.type, { durable: true });
    }
    for (const q of TOPOLOGY.queues) {
      // Onde as mensagens ficam armazenadas de fato (filas)
      // Esperando um consumer consumí-las
      await this.channel.assertQueue(q.name, { durable: true, arguments: q.args });
    }
    // 1. Exchange-to-Exchange Bindings (ex: tracking.raw -> tracking.hash)
    for (const eb of TOPOLOGY.exchangeBindings) {
      await this.channel.bindExchange(eb.destination, eb.source, eb.routingKey);
    }
    // 2. Queue Bindings (ex: tracking.hash -> q.track.0..15)
    for (const qb of TOPOLOGY.queueBindings) {
      await this.channel.bindQueue(qb.destination, qb.source, qb.routingKey);
    }

    this.logger.log(`RabbitMQ ready — ${TOPOLOGY.queues.length} partitions declared`);
  }

  getChannel() {
    return this.channel;
  }

  async onModuleDestroy() {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }
}
