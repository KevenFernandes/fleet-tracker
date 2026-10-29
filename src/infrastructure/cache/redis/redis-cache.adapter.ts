import { Injectable } from '@nestjs/common';
import { Cache } from '../../../application/ports/cache.port';
import { RedisService } from './redis.service';

@Injectable()
export class RedisCacheAdapter implements Cache {
  constructor(private readonly redis: RedisService) {}

  async get<T>(key: string): Promise<T | null> {
    const v = await this.redis.get(key);
    return v ? (JSON.parse(v) as T) : null;
  }

  async set<T>(key: string, value: T, ttlSeconds = 3600): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const r = await this.redis.set(key, value, 'EX', ttlSeconds, 'NX');
    return r === 'OK';
  }

  async geoAdd(key: string, lng: number, lat: number, member: string) {
    await this.redis.geoadd(key, lng, lat, member);
  }
}
