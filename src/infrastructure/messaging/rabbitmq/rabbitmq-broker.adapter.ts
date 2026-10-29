import { Injectable } from '@nestjs/common';
import { MessageBroker } from '../../../application/ports/message-broker.port';
import { RabbitmqService } from './rabbitmq.service';

@Injectable()
export class RabbitmqBrokerAdapter implements MessageBroker {
  constructor(private readonly rabbit: RabbitmqService) {}

  async publish(
    exchange: string,
    routingKey: string,
    payload: unknown,
    options: { persistent?: boolean; messageId?: string } = {},
  ): Promise<void> {
    const ch = this.rabbit.getChannel();
    ch.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), {
      persistent: options.persistent ?? true,
      messageId: options.messageId,
      contentType: 'application/json',
    });
  }

  async consume(
    queue: string,
    handler: (msg: unknown, raw: any) => Promise<void>,
    options: { prefetch?: number } = {},
  ): Promise<void> {
    const ch = this.rabbit.getChannel();
    await ch.prefetch(options.prefetch ?? 1);

    await ch.consume(
      queue,
      async (raw) => {
        if (!raw) return;
        try {
          const body = JSON.parse(raw.content.toString());
          await handler(body, raw);
          ch.ack(raw);
        } catch (err) {
          // NÃO use requeue=true → trava o comboio daquele veículo.
          // DLX recebe e um operador trata. Ordem do restante é preservada.
          ch.nack(raw, false, false);
        }
      },
      { noAck: false },
    );
  }
}
