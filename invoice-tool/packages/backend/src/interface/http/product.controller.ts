import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Inject,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { SyncProductsUseCase } from '../../application/product/sync-products.use-case';
import type { IProductRepository } from '../../domain/product/product.repository';
import type { ISyncConflictRepository } from '../../domain/product/sync-conflict.repository';
import { ProductResponseDto, SyncResultDto, ConflictResponseDto, ResolveConflictDto } from './dto/product-response.dto';

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
    @Inject('ISyncConflictRepository') private readonly conflictRepo: ISyncConflictRepository,
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

  /**
   * List all unresolved sync conflicts.
   * @returns Array of conflicts
   */
  @Get('conflicts')
  @ApiOperation({ summary: 'List unresolved product sync conflicts' })
  @ApiResponse({ status: 200, type: [ConflictResponseDto] })
  async listConflicts(): Promise<ConflictResponseDto[]> {
    const conflicts = await this.conflictRepo.findUnresolved();
    return conflicts.map(c => ({
      id: c.id,
      productId: c.productId,
      fieldName: c.fieldName,
      localValue: c.localValue,
      remoteValue: c.remoteValue,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  /**
   * Resolve a sync conflict by ID.
   * @param id Conflict ID
   * @param body Resolution action
   */
  @Post('conflicts/:id/resolve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Resolve a sync conflict' })
  @ApiResponse({ status: 200, description: 'Conflict resolved' })
  @ApiResponse({ status: 404, description: 'Conflict not found' })
  async resolveConflict(
    @Param('id') id: string,
    @Body() body: ResolveConflictDto,
  ): Promise<void> {
    // 'ignore' is treated as keep_local — marks conflict as resolved without changing data
    const resolution = body.action === 'accept_remote' ? 'accept_remote' : 'keep_local';
    await this.conflictRepo.resolve(id, resolution);
  }
}
