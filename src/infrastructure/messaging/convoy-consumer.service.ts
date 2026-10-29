import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MessageBroker } from '../../application/ports/message-broker.port';
import { ProcessTelemetryUseCase } from '../../application/use-cases/process-telemetry.use-case';
import { PARTITIONS, queueNameFor } from './topology';

/**
 * Cada instância de worker consome EXATAMENTE UMA partição.
 * A variável PARTITION define qual. Isso garante que todas as
 * mensagens de um mesmo IMEI (mesma routing key) sejam processadas
 * pelo MESMO consumidor, na ORDEM FIFO — o "comboio sequencial".
 */
@Injectable()
export class ConvoyConsumerService implements OnModuleInit {
  private readonly logger = new Logger(ConvoyConsumerService.name);

  constructor(
    @Inject('MessageBroker') private readonly broker: MessageBroker,
    private readonly processUC: ProcessTelemetryUseCase,
  ) {}

  async onModuleInit() {
    const partition = Number(process.env.PARTITION ?? 0);
    if (partition < 0 || partition >= PARTITIONS) {
      throw new Error(`Invalid PARTITION=${partition}. Expected 0..${PARTITIONS - 1}`);
    }
    const queue = queueNameFor(partition);

    this.logger.log(`Convoy worker listening on ${queue} (prefetch=1)`);

    await this.broker.consume(
      queue,
      async (payload) => this.processUC.execute(payload as any),
      { prefetch: 1 }, // => 1 por vez = ordem garantida
    );
  }
}
