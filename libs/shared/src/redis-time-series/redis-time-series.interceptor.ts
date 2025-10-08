import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { RedisTimeSeriesService } from './redis-time-series.service';
import { catchError, Observable, tap } from 'rxjs';

@Injectable()
export class RedisTimeSeriesInterceptor implements NestInterceptor {
  constructor(
    private readonly redisTimeSeriesService: RedisTimeSeriesService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const startTime = Date.now();
    const { method, url, route } = request;
    const serviceName = process.env.SERVICE_NAME || 'unknown-service';

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        this.redisTimeSeriesService.publishApiEvent({
          service: serviceName,
          method,
          path: route?.path || url,
          statusCode,
          duration,
          timestamp: startTime,
          userId: request.user?.id,
          metadata: {
            ip: request.ip,
            userAgent: request.headers['user-agent'],
          },
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;

        this.redisTimeSeriesService.publishApiEvent({
          service: serviceName,
          method,
          path: route?.path || url,
          statusCode,
          duration,
          timestamp: startTime,
          userId: request.user?.id,
          metadata: {
            ip: request.ip,
            userAgent: request.headers['user-agent'],
            error: error.message,
          },
        });

        throw error;
      }),
    );
  }
}
