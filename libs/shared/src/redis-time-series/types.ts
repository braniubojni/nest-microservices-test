export interface RedisTimeSeriesModuleOptions {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export interface ApiEvent {
  service: string;
  method: string;
  path: string;
  statusCode?: number;
  duration?: number;
  timestamp?: number;
  userId?: string;
  metadata?: Record<string, any>;
}
