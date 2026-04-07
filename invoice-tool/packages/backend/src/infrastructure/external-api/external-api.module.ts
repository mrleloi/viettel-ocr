import { Module } from '@nestjs/common';
import { ViettelProductClient } from './viettel-product.client';

/**
 * NestJS module for external API client services.
 * Provides the ViettelProductClient as the IProductApiClient implementation.
 * ConfigModule is @Global so no explicit import needed.
 */
@Module({
  providers: [
    ViettelProductClient,
    {
      provide: 'IProductApiClient',
      useExisting: ViettelProductClient,
    },
  ],
  exports: ['IProductApiClient'],
})
export class ExternalApiModule {}
