import { Global, Module } from '@nestjs/common';
import { RedisCacheAdapter } from './redis/redis-cache.adapter';
import { RedisService } from './redis/redis.service';

@Global()
@Module({
  providers: [RedisService, { provide: 'Cache', useClass: RedisCacheAdapter }],
  exports: ['Cache'],
})
export class CacheModule {}
