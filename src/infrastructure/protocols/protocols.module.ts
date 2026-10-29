import { Global, Module } from '@nestjs/common';
import { GenericJsonDecoder } from './decoders/generic-json.decoder';
import { Gt06Decoder } from './decoders/gt06.decoder';
import { Jt808Decoder } from './decoders/jt808.decoder';
import { ProtocolDecoderRegistry } from './protocol-decoder.registry';

@Global()
@Module({
  providers: [Gt06Decoder, Jt808Decoder, GenericJsonDecoder, ProtocolDecoderRegistry],
  exports: [ProtocolDecoderRegistry],
})
export class ProtocolsModule {}
