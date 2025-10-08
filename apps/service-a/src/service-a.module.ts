import { Module } from '@nestjs/common';
import { ProductsModule } from './products/products.module';
import { SharedModule } from '@app/shared/shared.module';
import { DataImportModule } from './data-import/data-import.module';

@Module({
  imports: [ProductsModule, SharedModule, DataImportModule],
  controllers: [],
  providers: [],
})
export class ServiceAModule {}
