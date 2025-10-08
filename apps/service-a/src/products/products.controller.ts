import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { SearchProductsDto } from './dto/product.dto';
import { TrackApi } from '@app/shared/redis-time-series/decorators/track-api.decorator';

@ApiTags('products')
@TrackApi()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @ApiOperation({ summary: 'Search products with filters and pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Products retrieved successfully',
  })
  @Get('search')
  async search(@Query() searchDto: SearchProductsDto) {
    return this.productsService.search(searchDto);
  }
}
