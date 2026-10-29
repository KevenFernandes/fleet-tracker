import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  constructor() {
    super(process.env.REDIS_URL!, { lazyConnect: false });
  }
  async onModuleDestroy() {
    await this.quit();
  }
}
