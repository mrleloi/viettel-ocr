import { Module } from '@nestjs/common';
import { ConfigModule } from './infrastructure/config/config.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { AiModule } from './infrastructure/ai/ai.module';
import { ExternalApiModule } from './infrastructure/external-api/external-api.module';
import { FileStorageModule } from './infrastructure/file-storage/file-storage.module';
import { HealthController } from './interface/http/health.controller';

/**
 * Root application module.
 * Imports infrastructure modules and registers controllers.
 */
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AiModule,
    ExternalApiModule,
    FileStorageModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

