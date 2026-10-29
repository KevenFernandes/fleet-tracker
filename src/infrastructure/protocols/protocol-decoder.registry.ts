import { Injectable } from '@nestjs/common';
import { ProtocolDecoder } from '../../application/ports/protocol-decoder.port';
import { GenericJsonDecoder } from './decoders/generic-json.decoder';
import { Gt06Decoder } from './decoders/gt06.decoder';
import { Jt808Decoder } from './decoders/jt808.decoder';

/** Registry por Strategy — adicionar nova marca = nova classe + 1 linha. */
@Injectable()
export class ProtocolDecoderRegistry {
  private readonly decoders: ProtocolDecoder[];

  constructor(gt06: Gt06Decoder, jt808: Jt808Decoder, json: GenericJsonDecoder) {
    this.decoders = [gt06, jt808, json];
  }

  get(protocol: string): ProtocolDecoder {
    const findDecode = this.decoders.find((x) => x.canDecode(protocol));
    if (!findDecode) throw new Error(`Unsupported protocol: ${protocol}`);
    return findDecode;
  }
}
