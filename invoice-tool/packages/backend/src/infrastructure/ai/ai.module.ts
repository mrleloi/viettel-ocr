import { Module } from '@nestjs/common';
import { GeminiClient } from './gemini.client';

/**
 * NestJS module for AI integration services.
 * Provides the GeminiClient as the IOcrService implementation.
 * ConfigModule is @Global so no explicit import needed.
 */
@Module({
  providers: [
    GeminiClient,
    {
      provide: 'IOcrService',
      useExisting: GeminiClient,
    },
  ],
  exports: ['IOcrService'],
})
export class AiModule {}
