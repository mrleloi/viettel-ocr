import {
  Controller,
  Post,
  Get,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { SyncProductsUseCase } from '../../application/product/sync-products.use-case';
import type { IProductRepository } from '../../domain/product/product.repository';
import { ProductResponseDto, SyncResultDto } from './dto/product-response.dto';

/**
 * ProductController — handles product sync and listing endpoints.
 * Thin controller: delegates to use cases and repositories.
 */
@ApiTags('Products')
@Controller('products')
export class ProductController {
  constructor(
    private readonly syncProductsUseCase: SyncProductsUseCase,
    @Inject('IProductRepository') private readonly productRepo: IProductRepository,
  ) {}

  /**
   * Sync products from Viettel API.
   * @returns Sync result with counts
   */
  @Post('sync')
  @ApiOperation({ summary: 'Sync products from Viettel API' })
  @ApiResponse({ status: 200, type: SyncResultDto })
  @ApiResponse({ status: 500, description: 'API connection error' })
  async syncProducts(): Promise<SyncResultDto> {
    const result = await this.syncProductsUseCase.execute();
    return {
      totalFetched: result.totalFetched,
      created: result.created,
      updated: result.updated,
      conflictsDetected: result.conflictsDetected,
    };
  }

  /**
   * List all products.
   * @returns Array of products
   */
  @Get()
  @ApiOperation({ summary: 'List all products' })
  @ApiResponse({ status: 200, type: [ProductResponseDto] })
  async listProducts(): Promise<ProductResponseDto[]> {
    const products = await this.productRepo.findAll();
    return products.map(p => ({
      id: p.id,
      productCode: p.productCode,
      productName: p.productName,
      category: p.category,
      syncStatus: p.syncStatus,
      lastSyncedAt: p.lastSyncedAt?.toISOString() ?? null,
    }));
  }
}
