import { ApiEvent } from '@app/shared/redis-time-series/types';
import { Log } from '@app/shared/schemas/log.schema';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FlattenMaps, Model } from 'mongoose';
import { QueryLogsDto } from './dto/query-logs.dto';
import { RedisTimeSeriesService } from '@app/shared/redis-time-series/redis-time-series.service';

@Injectable()
export class LogsService implements OnModuleInit {
  private readonly logger = new Logger(LogsService.name);

  constructor(
    @InjectModel(Log.name) private logModel: Model<Log>,
    private readonly redisTimeSeriesService: RedisTimeSeriesService,
  ) {}

  async onModuleInit() {
    await this.redisTimeSeriesService.subscribe('all', (event) => {
      this.storeLog(event).catch((error) =>
        this.logger.error(`Failed to store log from event: ${error.message}`),
      );
    });
  }

  /**
   * Store an API event as a log
   */
  async storeLog(event: ApiEvent): Promise<Log> {
    try {
      const logType = this.determineLogType(event);

      const log = new this.logModel({
        service: event.service,
        method: event.method,
        path: event.path,
        statusCode: event.statusCode,
        duration: event.duration,
        timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
        userId: event.userId,
        metadata: event.metadata,
        type: logType,
        errorMessage: event.metadata?.error,
      });

      const savedLog = await log.save();
      this.logger.debug(`Stored log: ${savedLog._id}`);
      return savedLog;
    } catch (error) {
      this.logger.error(`Failed to store log: ${error.message}`);
      throw error;
    }
  }

  /**
   * Query logs with filters
   */
  async queryLogs(queryDto: QueryLogsDto): Promise<{
    data: (FlattenMaps<Log> &
      Required<{
        _id: FlattenMaps<unknown>;
      }> & {
        __v: number;
      })[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const {
      service,
      method,
      path,
      type,
      fromDate,
      toDate,
      minDuration,
      maxDuration,
      minStatusCode,
      maxStatusCode,
      userId,
      page = 1,
      limit = 50,
      sortBy = 'timestamp',
      sortOrder = 'desc',
    } = queryDto;

    // Build query filter
    const filter: any = {};

    if (service) filter.service = service;
    if (method) filter.method = method;
    if (path) filter.path = { $regex: path, $options: 'i' };
    if (type) filter.type = type;
    if (userId) filter.userId = userId;

    // Date range filter
    if (fromDate || toDate) {
      filter.timestamp = {};
      if (fromDate) filter.timestamp.$gte = fromDate;
      if (toDate) filter.timestamp.$lte = toDate;
    }

    // Duration range filter
    if (minDuration !== undefined || maxDuration !== undefined) {
      filter.duration = {};
      if (minDuration !== undefined) filter.duration.$gte = minDuration;
      if (maxDuration !== undefined) filter.duration.$lte = maxDuration;
    }

    // Status code range filter
    if (minStatusCode !== undefined || maxStatusCode !== undefined) {
      filter.statusCode = {};
      if (minStatusCode !== undefined) filter.statusCode.$gte = minStatusCode;
      if (maxStatusCode !== undefined) filter.statusCode.$lte = maxStatusCode;
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const sortOptions: any = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [data, total] = await Promise.all([
      this.logModel
        .find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.logModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get log statistics
   */
  async getStatistics(
    service?: string,
    fromDate?: Date,
    toDate?: Date,
  ): Promise<any> {
    const filter: any = {};

    if (service) filter.service = service;
    if (fromDate || toDate) {
      filter.timestamp = {};
      if (fromDate) filter.timestamp.$gte = fromDate;
      if (toDate) filter.timestamp.$lte = toDate;
    } else {
      // Default to last hour if no dates provided
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      filter.timestamp = {
        $gte: oneHourAgo,
        $lte: now,
      };
    }

    const stats = await this.logModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          avgDuration: { $avg: '$duration' },
          minDuration: { $min: '$duration' },
          maxDuration: { $max: '$duration' },
        },
      },
    ]);

    const byService = await this.logModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$service',
          count: { $sum: 1 },
          avgDuration: { $avg: '$duration' },
        },
      },
    ]);

    const byMethod = await this.logModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$method',
          count: { $sum: 1 },
        },
      },
    ]);

    const topSlowEndpoints = await this.logModel
      .find(filter)
      .sort({ duration: -1 })
      .limit(10)
      .select('path method duration service')
      .lean();

    const recentErrors = await this.logModel
      .find({ ...filter, type: 'error' })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    return {
      overview: stats,
      byService,
      byMethod,
      topSlowEndpoints,
      recentErrors,
    };
  }

  /**
   * Get logs by service and time range
   */
  async getLogsByServiceAndTime(
    service: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<any[]> {
    return this.logModel
      .find({
        service,
        timestamp: { $gte: fromDate, $lte: toDate },
      })
      .sort({ timestamp: 1 })
      .lean()
      .exec();
  }

  /**
   * Delete old logs (for cleanup)
   */
  async deleteOldLogs(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.logModel.deleteMany({
      timestamp: { $lt: cutoffDate },
    });

    this.logger.log(`Deleted ${result.deletedCount} old logs`);
    return result.deletedCount;
  }

  /**
   * Determine log type based on event
   * Returns 'server_error' for 5xx, 'client_error' for 4xx, 'success' for 2xx, and 'request' otherwise.
   */
  private determineLogType(event: ApiEvent): string {
    if (event.statusCode) {
      if (event.statusCode >= 500) return 'server_error';
      if (event.statusCode >= 400) return 'client_error';
      if (event.statusCode >= 200 && event.statusCode < 300) return 'success';
    }
    return 'request';
  }
}
