export interface MessageBroker {
  publish(
    exchange: string,
    routingKey: string,
    payload: unknown, //TODO: Fazer generico aqui
    options?: { persistent?: boolean; messageId?: string },
  ): Promise<void>;

  consume(
    queue: string,
    handler: (msg: unknown, raw: any) => Promise<void>,
    options?: { prefetch?: number },
  ): Promise<void>;
}
