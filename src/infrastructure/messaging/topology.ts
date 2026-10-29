export const RABBITMQ_EXCHANGES = {
  TRACKING_RAW: 'tracking.raw', // topic — entrada da ingestão
  TRACKING_HASH: 'tracking.hash', // x-consistent-hash — roteia por IMEI
  TRACKING_DLX: 'tracking.dlx', // dead letter
} as const;

export const PARTITIONS = Number(process.env.PARTITIONS ?? 16);

export const queueNameFor = (partition: number) => `q.track.${partition}`;

// TRACKING_RAW => a mensagem vai junto com routing key => decide qual fila tem a bind compatível
// 'x-consistent-hash' => decide qual fila jogar a mensagem de acordo com um calculo de hash
// TRACKING_DLX (topic) => lixeiro inteligente ou quarentena - (mensagem que deu error)

/** Topologia declarada de forma idempotente no boot. */
export const TOPOLOGY = {
  // 3 Tipos de agencias com comportamentos diferentes
  exchanges: [
    { name: RABBITMQ_EXCHANGES.TRACKING_RAW, type: 'topic' },
    { name: RABBITMQ_EXCHANGES.TRACKING_HASH, type: 'x-consistent-hash' },
    { name: RABBITMQ_EXCHANGES.TRACKING_DLX, type: 'topic' },
  ],
  queues: Array.from({ length: PARTITIONS }, (_, i) => ({
    name: queueNameFor(i),
    args: {
      'x-queue-type': 'quorum', // ← durável (Raft)
      'x-dead-letter-exchange': RABBITMQ_EXCHANGES.TRACKING_DLX,
      'x-delivery-limit': 5,
    },
  })),
  // Exchange-to-Exchange: roteia de tracking.raw (topic) para tracking.hash (x-consistent-hash)
  exchangeBindings: [
    {
      source: RABBITMQ_EXCHANGES.TRACKING_RAW,
      destination: RABBITMQ_EXCHANGES.TRACKING_HASH,
      routingKey: '#', // encaminha tudo preservando a routing key original (IMEI)
    },
  ],
  // Queue Bindings: distribui de tracking.hash para cada partição com peso 1
  queueBindings: Array.from({ length: PARTITIONS }, (_, i) => ({
    source: RABBITMQ_EXCHANGES.TRACKING_HASH,
    destination: queueNameFor(i),
    routingKey: '1', // ← peso no hash ring
  })),
  // Mantido por compatibilidade
  get bindings() {
    return this.queueBindings;
  },
};

