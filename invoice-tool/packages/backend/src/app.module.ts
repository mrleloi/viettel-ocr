import { Module } from '@nestjs/common';
import { ConfigModule } from './infrastructure/config/config.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { HealthController } from './interface/http/health.controller';

/**
 * Root application module.
 * Imports infrastructure modules and registers controllers.
 */
@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [HealthController],
})
export class AppModule {}
