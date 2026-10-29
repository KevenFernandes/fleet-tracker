import { Telemetry } from '../../domain/entities/telemetry.entity';

export interface ProtocolDecoder<T = unknown> {
  readonly protocol: string;
  canDecode(protocol: string): boolean;
  decode(raw: T): Telemetry;
}
