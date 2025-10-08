import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Product extends Document {
  @Prop({ required: true, unique: true })
  productId: number;

  @Prop({ required: true, index: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  discountPercentage: number;

  @Prop({ required: true })
  rating: number;

  @Prop({ required: true })
  stock: number;

  @Prop({ required: true, index: true })
  brand: string;

  @Prop({ required: true, index: true })
  category: string;

  @Prop()
  thumbnail: string;

  @Prop([String])
  images: string[];

  @Prop({ type: Object })
  metadata: Record<string, any>;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ title: 'text', description: 'text', brand: 'text' });
ProductSchema.index({ category: 1, price: 1 });
ProductSchema.index({ brand: 1, rating: -1 });
