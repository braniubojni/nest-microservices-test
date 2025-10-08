import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { ApiEvent, type RedisTimeSeriesModuleOptions } from './types';

@Injectable()
export class RedisTimeSeriesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisTimeSeriesService.name);
  private redisClient: Redis;
  private pubClient: Redis;
  private subClient: Redis;
  private eventHandlers: Map<string, Array<(event: ApiEvent) => void>> =
    new Map();

  constructor(
    @Inject('REDIS_TIMESERIES_OPTIONS')
    private readonly options: RedisTimeSeriesModuleOptions,
  ) {}

  async onModuleInit() {
    this.redisClient = new Redis({
      host: this.options.host,
      port: this.options.port,
      password: this.options.password,
      db: this.options.db || 0,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    // Publisher client
    this.pubClient = new Redis({
      host: this.options.host,
      port: this.options.port,
      password: this.options.password,
      db: this.options.db || 0,
    });

    // Subscriber client
    this.subClient = new Redis({
      host: this.options.host,
      port: this.options.port,
      password: this.options.password,
      db: this.options.db || 0,
    });

    this.redisClient.on('error', (err) => {
      this.logger.debug(`Redis Client Error: ${err.message}`);
    });

    this.redisClient.on('connect', () => {
      this.logger.log('Redis TimeSeries connected');
    });

    // Setup subscriber
    this.subClient.on('message', (channel, message) => {
      try {
        const event: ApiEvent = JSON.parse(message);
        const handlers = this.eventHandlers.get(channel);
        if (handlers) {
          handlers.forEach((handler) => handler(event));
        }
      } catch (error) {
        this.logger.debug(`Error processing message: ${error.message}`);
      }
    });

    await this.ensureTimeSeriesCreated();
  }

  async onModuleDestroy() {
    await this.redisClient?.quit();
    await this.pubClient?.quit();
    await this.subClient?.quit();
  }

  private async ensureTimeSeriesCreated() {
    const keys = ['ts:api:requests', 'ts:api:errors', 'ts:api:duration'];

    for (const key of keys) {
      try {
        // Check if key exists
        const exists = await this.redisClient.exists(key);
        if (!exists) {
          // Create time series with retention (7 days = 604800000 ms)
          await this.redisClient.call(
            'TS.CREATE',
            key,
            'RETENTION',
            '604800000',
            'DUPLICATE_POLICY',
            'LAST',
            'LABELS',
            'type',
            key.split(':')[2],
          );
          this.logger.log(`Created time series: ${key}`);
        }
      } catch (error) {
        // Time series might already exist, ignore error
        this.logger.debug(`Time series ${key} setup: ${error.message}`);
      }
    }
  }

  /**
   * @description Publish an API event to Redis Time Series and pub/sub
   */
  async publishApiEvent(event: ApiEvent): Promise<void> {
    try {
      const timestamp = event.timestamp || Date.now();
      const baseLabels = `service=${event.service},method=${event.method},path=${event.path}`;

      // Add to time series for requests
      await this.redisClient.call(
        'TS.ADD',
        'ts:api:requests',
        timestamp,
        '1',
        'LABELS',
        ...baseLabels.split(',').flatMap((label) => label.split('=')),
      );

      // Add duration if available
      if (event.duration) {
        await this.redisClient.call(
          'TS.ADD',
          'ts:api:duration',
          timestamp,
          event.duration,
          'LABELS',
          ...baseLabels.split(',').flatMap((label) => label.split('=')),
        );
      }

      // Add to errors if status code indicates error
      if (event.statusCode && event.statusCode >= 400) {
        await this.redisClient.call(
          'TS.ADD',
          'ts:api:errors',
          timestamp,
          '1',
          'LABELS',
          ...baseLabels.split(',').flatMap((label) => label.split('=')),
          'statusCode',
          event.statusCode.toString(),
        );
      }

      // Publish to pub/sub channel
      const channel = `api:events:${event.service}`;
      await this.pubClient.publish(channel, JSON.stringify(event));

      // Also publish to a general channel
      await this.pubClient.publish('api:events:all', JSON.stringify(event));
    } catch (error) {
      this.logger.debug(`Failed to publish API event: ${error.message}`);
    }
  }

  /**
   * Subscribe to API events from specific service or all services
   */
  async subscribe(
    service: string,
    handler: (event: ApiEvent) => void,
  ): Promise<void> {
    const channel =
      service === 'all' ? 'api:events:all' : `api:events:${service}`;

    if (!this.eventHandlers.has(channel)) {
      this.eventHandlers.set(channel, []);
      await this.subClient.subscribe(channel);
      this.logger.log(`Subscribed to channel: ${channel}`);
    }

    const handlers = this.eventHandlers.get(channel);
    if (handlers) {
      handlers.push(handler);
    }
  }

  /**
   * @description Get request count in time range
   */
  async getRequestCount(
    service?: string,
    fromTimestamp?: number,
    toTimestamp?: number,
  ): Promise<any> {
    try {
      const from = fromTimestamp || Date.now() - 3600000; // Default: last hour
      const to = toTimestamp || Date.now();

      let filter = '';
      if (service) {
        filter = `service=${service}`;
      }

      const result = await this.redisClient.call(
        'TS.RANGE',
        'ts:api:requests',
        from,
        to,
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to get request count: ${error.message}`);
      return [];
    }
  }

  /**
   * @description Cleanup old data (if needed)
   */
  async cleanup() {
    try {
      const keys = ['ts:api:requests', 'ts:api:errors', 'ts:api:duration'];

      for (const key of keys) {
        await this.redisClient.call(
          'TS.CREATERULE',
          key,
          'temp:cleanup',
          'AGGREGATION',
          'sum',
          60000,
        );
        await this.redisClient.call('DEL', 'temp:cleanup');
        this.logger.log(`Cleaned up time series: ${key}`);
      }
    } catch (error) {
      // this.logger.error(`Failed to cleanup time series: ${error.message}`);
    }
  }

  /**
   * @description Get average response time in time range
   */
  async getAverageDuration(
    service?: string,
    fromTimestamp?: number,
    toTimestamp?: number,
  ): Promise<any> {
    try {
      const from = fromTimestamp || Date.now() - 3600000;
      const to = toTimestamp || Date.now();

      let filter = '';
      if (service) {
        filter = `service=${service}`;
      }

      const result = await this.redisClient.call(
        'TS.RANGE',
        'ts:api:duration',
        from,
        to,
        'AGGREGATION',
        'avg',
        60000, // 1 minute buckets
        ...(filter ? ['FILTER', filter] : []),
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to get average duration: ${error.message}`);
      return [];
    }
  }

  /**
   * @description Get error count in time range
   */
  async getErrorCount(
    service?: string,
    fromTimestamp?: number,
    toTimestamp?: number,
  ): Promise<any> {
    try {
      const from = fromTimestamp || Date.now() - 3600000;
      const to = toTimestamp || Date.now();

      let filter = '';
      if (service) {
        filter = `service=${service}`;
      }

      const result = await this.redisClient.call(
        'TS.RANGE',
        'ts:api:errors',
        from,
        to,
        'AGGREGATION',
        'sum',
        60000,
        ...(filter ? ['FILTER', filter] : []),
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to get error count: ${error.message}`);
      return [];
    }
  }
}
