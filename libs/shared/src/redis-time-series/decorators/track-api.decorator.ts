import { UseInterceptors } from '@nestjs/common';
import { RedisTimeSeriesInterceptor } from '../redis-time-series.interceptor';

/**
 * @description Decorator to track API calls with Redis Time Series
 * Can be applied to controllers or individual routes
 */
export const TrackApi = () => UseInterceptors(RedisTimeSeriesInterceptor);
