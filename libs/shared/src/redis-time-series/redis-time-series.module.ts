import { DynamicModule, Global, Module } from '@nestjs/common';
import { RedisTimeSeriesModuleOptions } from './types';
import { RedisTimeSeriesService } from './redis-time-series.service';
import { RedisTimeSeriesInterceptor } from './redis-time-series.interceptor';

@Global()
@Module({})
export class RedisTimeSeriesModule {
  static forRoot(options: RedisTimeSeriesModuleOptions): DynamicModule {
    return {
      module: RedisTimeSeriesModule,
      providers: [
        {
          provide: 'REDIS_TIMESERIES_OPTIONS',
          useValue: options,
        },
        RedisTimeSeriesService,
      ],
      exports: [RedisTimeSeriesService],
    };
  }

  static forRootAsync(options: {
    useFactory: (
      ...args: any[]
    ) => Promise<RedisTimeSeriesModuleOptions> | RedisTimeSeriesModuleOptions;
    inject?: any[];
  }): DynamicModule {
    return {
      module: RedisTimeSeriesModule,
      providers: [
        {
          provide: 'REDIS_TIMESERIES_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        RedisTimeSeriesService,
        RedisTimeSeriesInterceptor,
      ],
      exports: [RedisTimeSeriesService, RedisTimeSeriesInterceptor],
    };
  }
}
