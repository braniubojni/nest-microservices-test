import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Log extends Document {
  @Prop({ required: true, index: true })
  service: string;

  @Prop({ required: true, index: true })
  method: string;

  @Prop({ required: true })
  path: string;

  @Prop({ index: true })
  statusCode?: number;

  @Prop()
  duration?: number;

  @Prop({ required: true, index: true })
  timestamp: Date;

  @Prop()
  userId?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop({ index: true })
  type: string; // 'request', 'error', 'success'

  @Prop()
  errorMessage?: string;
}

export const LogSchema = SchemaFactory.createForClass(Log);

// Create compound indexes for better query performance
LogSchema.index({ service: 1, timestamp: -1 });
LogSchema.index({ type: 1, timestamp: -1 });
LogSchema.index({ service: 1, type: 1, timestamp: -1 });
